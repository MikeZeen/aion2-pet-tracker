"""
Network diagnostics: checks Administrator rights and Npcap, then listens on
every adapter and reports which connections carry game traffic. Saved to
%LOCALAPPDATA%\\aion2-pet-tracker\\diagnostics.txt.
"""

import ctypes
import os
import platform
import time
from collections import Counter, defaultdict
from pathlib import Path

from scapy.all import IP, TCP, Raw, conf, sniff

from protocol import GAME_PORT, ServerStream

LISTEN_SECONDS = 20
REPORT_PATH = Path(os.environ.get("LOCALAPPDATA", ".")) / "aion2-pet-tracker" / "diagnostics.txt"
NPCAP_DLL = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "Npcap" / "wpcap.dll"


def capture_interfaces():
    """Connected adapters with a real IPv4 address."""
    found = []
    for iface in conf.ifaces.values():
        ips = [ip for ip in iface.ips.get(4, []) if not ip.startswith(("127.", "169.254."))]
        flags = str(getattr(iface, "flags", ""))
        if ips and "LOOPBACK" not in flags and "DISCONNECTED" not in flags:
            found.append(iface)
    return found


def looks_like_game(payloads):
    """Share of a server stream that splits cleanly into game messages."""
    stream, parsed, total = ServerStream(), 0, 0
    for seq, data in payloads:
        total += len(data)
        parsed += sum(len(m) + 2 for _, _, m in stream.feed(seq, 0.0, data))
    return parsed / total if total else 0.0


def report():
    lines = []
    out = lines.append
    out(f"AION 2 Pet Tracker - network diagnostics, {time.strftime('%Y-%m-%d %H:%M:%S')}")
    out(f"Windows {platform.version()}")
    admin = bool(ctypes.windll.shell32.IsUserAnAdmin())
    out(f"Administrator: {'yes' if admin else 'NO - live capture needs it'}")
    out(f"Npcap: {'installed' if NPCAP_DLL.exists() else 'NOT FOUND - install it from https://npcap.com'}"
        f" (scapy uses pcap: {conf.use_pcap})")
    out(f"Default adapter: {getattr(conf.iface, 'name', conf.iface)}")
    out("")
    out("Adapters:")
    usable = capture_interfaces()
    for iface in conf.ifaces.values():
        mark = "*" if iface in usable else " "
        out(f" {mark} {iface.name} | {iface.description} | {', '.join(iface.ips.get(4, [])) or 'no IPv4'} | {iface.flags}")
    out("   (* = listened on)")
    out("")

    if not usable:
        out("No usable adapter found.")
        return "\n".join(lines)

    # Bytes per (adapter, server address, server port).
    local = {ip for i in conf.ifaces.values() for ip in i.ips.get(4, [])}
    volume = Counter()
    payloads = defaultdict(list)

    def count(pkt):
        if IP not in pkt or TCP not in pkt:
            return
        ip, tcp = pkt[IP], pkt[TCP]
        incoming = ip.dst in local
        server = (ip.src, tcp.sport) if incoming else (ip.dst, tcp.dport)
        key = (getattr(pkt, "sniffed_on", "?"), *server)
        volume[key] += len(pkt)
        if incoming and Raw in pkt and len(payloads[key]) < 400:
            payloads[key].append((tcp.seq, bytes(pkt[Raw].load)))

    out(f"Listening on {len(usable)} adapter(s) for {LISTEN_SECONDS} s - play normally meanwhile...")
    try:
        sniff(iface=[i.name for i in usable], filter="tcp", prn=count, store=False, timeout=LISTEN_SECONDS)
    except Exception as e:  # noqa: BLE001
        out(f"Capture FAILED: {e}")
        return "\n".join(lines)

    out("")
    out("Busiest TCP connections (adapter | server | bytes | game framing):")
    game = []
    for (iface, host, port), size in volume.most_common(12):
        share = looks_like_game(payloads[(iface, host, port)])
        if share > 0.9:
            game.append((iface, host, port))
        flag = "  <- AION 2" if share > 0.9 else ""
        out(f"   {iface} | {host}:{port} | {size:,} | {min(share, 1):.0%}{flag}")
    out("")

    if not volume:
        out("RESULT: no TCP traffic at all on these adapters. Is the game running? Npcap installed with default options?")
    elif not game:
        out(f"RESULT: no connection looks like AION 2. Was the game in the world (not the launcher)? Expected server port {GAME_PORT}.")
    else:
        for iface, host, port in game:
            note = "OK" if port == GAME_PORT else f"DIFFERENT PORT than the expected {GAME_PORT} - the watcher needs updating"
            out(f"RESULT: game traffic on adapter '{iface}', server {host}:{port} - {note}")
    return "\n".join(lines)


def run():
    text = report()
    try:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(text, encoding="utf-8")
        path = str(REPORT_PATH)
    except OSError:
        path = None
    return text, path
