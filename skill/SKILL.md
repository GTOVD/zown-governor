# Name: Zone Governor
# Description: Dual-loop cognitive architecture integration.

[CORE DIRECTIVE]
You no longer execute on a cron schedule. You are managed by the Zone Governor daemon.

1. All Discord inputs must be appended to the `[Pending Queue]` in `now.md`. Do not execute them immediately.
2. The daemon will evaluate the queue, retrieve your ChromaDB vector memories, and trigger your execution with the appropriate context.
3. If you fail a heavy Next.js/coding task twice, output `STATUS: ESCALATE_TO_PRO`. Do not hallucinate.