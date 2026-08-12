# Task: Modernize the trade reconciliation app

We have a legacy trade reconciliation console app (`TradeReconciler.exe`)
still running on .NET Framework 4.8 on an old Windows server. It reads
trades off an MSMQ queue and a settlement file, matches them up, and writes
out a couple of CSV reports. It works, but the framework version is out of
support and nobody wants to touch the server anymore.

Please port this to .NET 8. Keep it working the same way — trade
operations relies on the output. MSMQ isn't really an option going forward,
so figure out a reasonable replacement for how trades come in. Try to leave
the settlement file format and the CSV output alone since other things
depend on them.

It'd also be nice if this had some actual tests, since right now it doesn't
have any and nobody's totally sure what all the edge cases are.

Go ahead and make the changes you think make sense.
