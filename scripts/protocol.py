"""
Aion 2 server->client protocol (TCP port 13328).

The stream is a series of messages: varint L | (L - 4) bytes, starting with a
2-byte type. Type ffff is a bundle: unpacked size (u32) | LZ4 block holding
more messages in the same framing.

Message types (integers little-endian):
    4136  monster appears: entity (varint) | 3 bytes | template id (u32) |
          2 bytes | x, y, z (floats)
    2156  item picked up: 0000 | drop group (u32) | pile serial (u32) | u8
    1f56  drop taken: 01 | source entity (u32) | drop group (u32) |
          pile serial (u32) | item kind (u32) | ...
    0d90  pet souls gained: n (u8) | n x (pet id u32, count u32)
    1190  souls of a maxed pet: 01 | kind (u8) | count (u8) | 00 00 00 02
    0090  collection at login: varint n | n x (pet id, pet id, level) |
          varint m | m x (pet id, souls in current level) | ...
    0191  area info, every 3 s: 0000 | map id (u32) | ...
    0238  attack: attacker (varint) | 00 | skill (u32) | counter (u16) |
          target (varint) | 4 bytes | x, y, z (floats)
    2937, 2837, 1a37  entity moves: entity (varint) | 1 byte (2 for 1a37) |
          x, y, z (floats); never your own character
    398a  character selected: len (u8) | name; also sent for other players,
          e.g. legion members logging in
    3336  your character enters the world: entity (varint) | 5 bytes |
          len | name
"""

import struct

GAME_PORT = 13328

MONSTER_SPAWN = "4136"
ITEM_PICKED_UP = "2156"
DROP_TAKEN = "1f56"
SOUL_GAINED = "0d90"
SOUL_FOR_MAXED = "1190"
COLLECTION = "0090"
AREA_INFO = "0191"
CHARACTER_SELECTED = "398a"
CHARACTER_ENTERS = "3336"
ATTACK = "0238"
# Movement type -> bytes between the entity varint and x, y, z.
MOVEMENT = {"2937": 1, "2837": 1, "1a37": 2}

MAX_MESSAGE = 1 << 16
BUNDLE = "ffff"


def read_varint(buf, i):
    """Returns (value, index after it), or None if buf ends mid-varint."""
    value = shift = 0
    while i < len(buf):
        byte = buf[i]
        i += 1
        value |= (byte & 0x7F) << shift
        if byte < 0x80:
            return value, i
        shift += 7
    return None


class ServerStream:
    """Reassembles one TCP stream by sequence number and splits it into
    messages. A gap that never fills is skipped after MAX_PENDING segments."""

    MAX_PENDING = 64

    def __init__(self):
        self.next_seq = None
        self.pending = {}  # seq -> (time, payload)
        self.buf = bytearray()
        self.buf_time = 0.0

    def feed(self, seq, time, payload):
        """Feeds one TCP segment; yields (time, type hex, message bytes)."""
        if self.next_seq is None:
            self.next_seq = seq
        self.pending.setdefault(seq, (time, payload))
        if len(self.pending) > self.MAX_PENDING:
            self.next_seq = min(self.pending)
            self.buf.clear()
        while True:
            ready = [s for s in self.pending if s <= self.next_seq]
            if not ready:
                break
            for s in ready:
                t, data = self.pending.pop(s)
                data = data[self.next_seq - s :]
                if data:
                    if not self.buf:
                        self.buf_time = t
                    self.buf += data
                    self.next_seq += len(data)
        yield from self._split()

    def _split(self):
        i = 0
        while True:
            header = read_varint(self.buf, i)
            if header is None:
                break
            length, body_start = header
            end = body_start + length - 4
            if length < 6 or length > MAX_MESSAGE:
                # Out of sync; the next segment starts a new message.
                self.buf.clear()
                return
            if end > len(self.buf):
                break
            message = bytes(self.buf[body_start:end])
            if message[:2].hex() == BUNDLE:
                yield from ((self.buf_time, kind, inner) for kind, inner in unbundle(message))
            else:
                yield self.buf_time, message[:2].hex(), message
            i = end
        del self.buf[:i]


def lz4_block(src, size):
    """Decompresses one LZ4 block (no frame header) of known output size."""
    out = bytearray()
    i = 0
    while i < len(src):
        token = src[i]
        i += 1
        literals = token >> 4
        if literals == 15:
            while True:
                extra = src[i]
                i += 1
                literals += extra
                if extra != 255:
                    break
        out += src[i : i + literals]
        i += literals
        if i >= len(src) or len(out) >= size:
            break  # the last sequence has literals only
        offset = src[i] | (src[i + 1] << 8)
        i += 2
        match = token & 15
        if match == 15:
            while True:
                extra = src[i]
                i += 1
                match += extra
                if extra != 255:
                    break
        start = len(out) - offset
        for j in range(match + 4):  # byte by byte: matches may overlap
            out.append(out[start + j])
    return bytes(out)


def unbundle(message):
    """(type, message) for each message in an ffff bundle."""
    try:
        size = struct.unpack_from("<I", message, 2)[0]
        data = lz4_block(message[6:], size)
    except (IndexError, struct.error):
        return
    i = 0
    while i < len(data):
        header = read_varint(data, i)
        if header is None:
            return
        length, body_start = header
        end = body_start + length - 4
        if length < 6 or end > len(data):
            return
        inner = data[body_start:end]
        if inner[:2].hex() == BUNDLE:
            yield from unbundle(inner)
        else:
            yield inner[:2].hex(), inner
        i = end


def decode_spawn(message):
    """4136 message -> (entity, template id)."""
    entity, i = read_varint(message, 2)
    return entity, struct.unpack_from("<I", message, i + 3)[0]


def decode_drop_taken(message):
    """1f56 message -> (source monster entity, drop group, serial, item kind)."""
    return struct.unpack_from("<IIII", message, 3)


def decode_souls(message):
    """0d90 message -> [(pet id, count), ...]."""
    return [
        (pet_id, max(1, min(count, 100)))
        for pet_id, count in (struct.unpack_from("<II", message, 3 + 8 * i) for i in range(message[2]))
    ]


def decode_collection(message):
    """0090 message -> [[pet id, level, souls in level], ...] or None.
    Level 0 = locked."""
    count1, i = read_varint(message, 2 + 4)
    levels = {}
    for _ in range(count1):
        pet_id, again, level = struct.unpack_from("<III", message, i)
        if pet_id != again or not 1 <= level <= 3:
            return None
        levels[pet_id] = level
        i += 12
    count2, i = read_varint(message, i)
    souls = {}
    for _ in range(count2):
        pet_id, n = struct.unpack_from("<II", message, i)
        souls[pet_id] = n
        i += 8
    if not levels:
        return None
    return [
        [pet_id, levels.get(pet_id, 0), 0 if levels.get(pet_id) == 3 else souls.get(pet_id, 0)]
        for pet_id in sorted(levels.keys() | souls.keys())
    ]


def decode_map(message):
    """0191 message -> map id."""
    return struct.unpack_from("<I", message, 4)[0]


def decode_item_gained(message):
    """2156 message -> (drop group, serial)."""
    item_id, serial = struct.unpack_from("<II", message, 4)
    return item_id, serial


class SoulTracker:
    """Pet souls you got (0d90/1190), with the source monster when known:
    your pickup (2156) and the drop with the same serial (1f56) name the
    monster's entity, whose spawn (4136) gives its template id."""

    MAX_SPAWNS = 50_000
    PICKUP_SECONDS = 1.0

    def __init__(self):
        self.spawns = {}  # entity -> template id
        self.sources = {}  # pile serial -> source monster entity
        self.pickups = []  # [(time, serial)]

    def feed(self, time, kind, message):
        try:
            if kind == MONSTER_SPAWN:
                entity, template = decode_spawn(message)
                if len(self.spawns) > self.MAX_SPAWNS:
                    self.spawns.clear()
                self.spawns[entity] = template
            elif kind == DROP_TAKEN:
                source, _group, serial, _item = decode_drop_taken(message)
                if len(self.sources) > self.MAX_SPAWNS:
                    self.sources.clear()
                self.sources[serial] = source
            elif kind == ITEM_PICKED_UP:
                _, serial = decode_item_gained(message)
                self.pickups = [(t, s) for t, s in self.pickups if t >= time - self.PICKUP_SECONDS]
                self.pickups.append((time, serial))
            elif kind == SOUL_GAINED:
                # With several pets in one message the source monster is ambiguous.
                souls = decode_souls(message)
                monster = self._monster(time) if len(souls) == 1 else None
                for pet_id, count in souls:
                    yield {"type": "loot", "itemId": str(pet_id), "count": count, "monsterId": monster}
            elif kind == SOUL_FOR_MAXED:
                count = max(1, message[4])
                yield {"type": "loot", "itemId": None, "count": count, "maxed": True, "monsterId": self._monster(time)}
            elif kind == COLLECTION and len(message) > 100:
                if (pets := decode_collection(message)) is not None:
                    yield {"type": "collection", "pets": pets}
        except (struct.error, TypeError):
            pass

    def _monster(self, now):
        recent = [s for t, s in self.pickups if now - self.PICKUP_SECONDS <= t <= now]
        if not recent:
            return None
        return self.spawns.get(self.sources.get(recent[-1]))


class AreaTracker:
    """The map id (0191) and the monsters that appeared around you lately:
    all of the last few minutes, plus the last half minute with their age."""

    NEARBY_SECONDS = 300
    RECENT_SECONDS = 30
    MIN_INTERVAL = 0.5

    def __init__(self):
        self.map_id = None
        self.seen = {}  # monster id -> last time it appeared
        self.changed = False
        self.last_report = 0.0

    def feed(self, time, kind, message):
        try:
            if kind == AREA_INFO:
                map_id = decode_map(message)
                if map_id != self.map_id:
                    self.map_id = map_id
                    self.seen.clear()
                    self.changed = True
                    yield {"type": "zone", "mapId": map_id}
            elif kind == MONSTER_SPAWN:
                self.seen[decode_spawn(message)[1]] = time
                self.changed = True
        except (struct.error, TypeError):
            return
        if time - self.last_report < self.MIN_INTERVAL:
            return
        kept = {m: t for m, t in self.seen.items() if t >= time - self.NEARBY_SECONDS}
        if len(kept) != len(self.seen):
            self.changed = True
        self.seen = kept
        if self.changed:
            self.changed = False
            self.last_report = time
            recent = sorted(
                ([m, round(time - t, 1)] for m, t in self.seen.items() if t >= time - self.RECENT_SECONDS),
                key=lambda pair: pair[1],
            )
            yield {"type": "nearby", "monsters": sorted(self.seen), "recent": recent}


def decode_character_selected(message):
    """398a message -> character name."""
    return message[3 : 3 + message[2]].decode("utf-8")


def decode_character_enters(message):
    """3336 message -> (entity, character name bytes)."""
    entity, i = read_varint(message, 2)
    return entity, message[i + 6 : i + 6 + message[i + 5]]


def own_entity(message, name_bytes):
    """Your entity from a message naming you: <entity varint> 00 09 <len><name>."""
    idx = message.find(bytes([len(name_bytes)]) + name_bytes)
    if idx < 4 or message[idx - 2 : idx] != b"\x00\x09":
        return None
    start = idx - 3
    while start > 0 and message[start - 1] & 0x80:
        start -= 1
    entity = read_varint(message, start)
    return entity[0] if entity and entity[1] == idx - 2 else None


def decode_attack(message):
    """0238 message -> (attacker entity, (x, y) or None)."""
    entity, i = read_varint(message, 2)
    _target, j = read_varint(message, i + 7)
    if len(message) < j + 16:
        return entity, None
    x, y, z = struct.unpack_from("<fff", message, j + 4)
    if not (abs(x) < 1_000_000 and abs(y) < 1_000_000 and abs(z) < 20_000):
        return entity, None
    # Self-targeted skills carry small relative values instead of a position.
    if abs(x) < 2000 and abs(y) < 2000:
        return entity, None
    return entity, (x, y)


def world_position(message, offset):
    """(x, y) of the floats at offset, or None if implausible."""
    x, y, z = struct.unpack_from("<fff", message, offset)
    if abs(x) < 1_000_000 and abs(y) < 1_000_000 and abs(z) < 20_000:
        return x, y
    return None


def median_point(positions):
    """Per-axis median of [(time, x, y), ...]."""
    xs = sorted(p[1] for p in positions)
    ys = sorted(p[2] for p in positions)
    return xs[len(xs) // 2], ys[len(ys) // 2]


class PositionTracker:
    """Your character and position. Sources, best first: your attacks
    ("self"), the middle of monsters that just appeared ("monsters"), and
    roughly, the middle of entities moving around you ("movement")."""

    SELF_SECONDS = 10
    NEARBY_SECONDS = 15
    MIN_MOVERS = 3
    MIN_INTERVAL = 1.0
    MIN_MOVE = 500  # world units

    def __init__(self, character=None):
        self.name = character.encode("utf-8") if character else None
        self.selected = set()  # names from 398a not yet seen entering (3336)
        self.own = None
        self.own_pos = None  # (time, x, y)
        self.spawns = {}  # entity -> (time, x, y)
        self.movers = {}  # entity -> (time, x, y)
        self.last_report = 0.0
        self.reported = None  # (source, x, y)

    def feed(self, time, kind, message):
        try:
            if kind == CHARACTER_SELECTED:
                # Also sent for others (e.g. legion members logging in), so
                # it only names a candidate until that character enters.
                self.selected.add(decode_character_selected(message).encode("utf-8"))
            elif kind == CHARACTER_ENTERS:
                entity, name = decode_character_enters(message)
                if name in self.selected or name == self.name:
                    self.selected.clear()
                    if name != self.name:
                        self.name, self.own_pos = name, None
                    self.own = entity
                    yield {"type": "character", "name": name.decode("utf-8")}
            if self.own is None and self.name and self.name in message:
                self.own = own_entity(message, self.name)
            if kind == MONSTER_SPAWN:
                entity, i = read_varint(message, 2)
                if (pos := world_position(message, i + 9)) is not None:
                    self.spawns[entity] = (time, *pos)
            elif kind in MOVEMENT:
                entity, i = read_varint(message, 2)
                if (pos := world_position(message, i + MOVEMENT[kind])) is not None:
                    self.movers[entity] = (time, *pos)
            elif kind == ATTACK and self.own is not None:
                entity, pos = decode_attack(message)
                if entity == self.own and pos:
                    self.own_pos = (time, *pos)
        except (struct.error, TypeError):
            return
        if time - self.last_report < self.MIN_INTERVAL:
            return
        self.spawns = {e: p for e, p in self.spawns.items() if p[0] >= time - self.NEARBY_SECONDS}
        self.movers = {e: p for e, p in self.movers.items() if p[0] >= time - self.NEARBY_SECONDS}
        if self.own_pos and time - self.own_pos[0] <= self.SELF_SECONDS:
            source, x, y = "self", self.own_pos[1], self.own_pos[2]
        elif self.spawns:
            source, (x, y) = "monsters", median_point(self.spawns.values())
        elif len(self.movers) >= self.MIN_MOVERS:
            source, (x, y) = "movement", median_point(self.movers.values())
        else:
            return
        if self.reported:
            s0, x0, y0 = self.reported
            if s0 == source and abs(x - x0) < self.MIN_MOVE and abs(y - y0) < self.MIN_MOVE:
                return
        self.reported = (source, x, y)
        self.last_report = time
        yield {"type": "position", "x": round(x), "y": round(y), "source": source}
