"""
Packet watcher: decodes the game's traffic (protocol.py) and prints one JSON
event per line for the app: listening, ready, character, collection, loot,
zone, nearby, position, error.

    python watcher.py [--iface NAME] [--character NAME]   live, needs Administrator
    python watcher.py --replay capture.pcap               replay a saved capture
    python watcher.py --diagnose                          network report
"""

import argparse
import json
import sys

from scapy.all import IP, TCP, Raw, rdpcap, sniff

from protocol import GAME_PORT, AreaTracker, PositionTracker, ServerStream, SoulTracker


def emit(obj):
    print(json.dumps(obj), flush=True)


def run(iface, replay_path, character=None):
    # One stream per connection: a login can open a new one.
    streams = {}
    trackers = [SoulTracker(), AreaTracker(), PositionTracker(character)]
    ready = [False]

    def handle(pkt):
        if IP not in pkt or TCP not in pkt or pkt[TCP].sport != GAME_PORT:
            return
        connection = pkt[TCP].dport
        if "S" in str(pkt[TCP].flags):
            streams.pop(connection, None)
        if Raw not in pkt:
            return
        stream = streams.setdefault(connection, ServerStream())
        for t, kind, message in stream.feed(pkt[TCP].seq, float(pkt.time), bytes(pkt[Raw].load)):
            if not ready[0]:
                ready[0] = True
                emit({"type": "ready"})
            for tracker in trackers:
                for event in tracker.feed(t, kind, message):
                    emit(event)

    if replay_path:
        for pkt in rdpcap(replay_path):
            handle(pkt)
        emit({"type": "done"})
        return

    # All connected adapters: VPNs and ping tools route the game elsewhere.
    from diagnose import capture_interfaces

    ifaces = [iface] if iface else [i.name for i in capture_interfaces()] or None
    emit({"type": "listening", "iface": ", ".join(ifaces) if ifaces else "default"})
    sniff(iface=ifaces, prn=handle, store=False, filter=f"tcp port {GAME_PORT}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--character", help="Last known character name, for starts mid-session")
    parser.add_argument("--iface", help="Network interface name")
    parser.add_argument("--replay", help="Replay a .pcap file instead of capturing live")
    parser.add_argument("--diagnose", action="store_true", help="Network diagnostics report")
    args = parser.parse_args()

    if args.diagnose:
        from diagnose import run as diagnose

        text, path = diagnose()
        emit({"type": "diagnostics", "text": text, "path": path})
        return

    try:
        run(args.iface, args.replay, args.character)
    except PermissionError:
        emit({"type": "error", "message": "Permission denied - run as Administrator"})
        sys.exit(1)
    except Exception as e:  # noqa: BLE001
        emit({"type": "error", "message": str(e)})
        sys.exit(1)


if __name__ == "__main__":
    main()
