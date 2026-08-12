# Task: Add an audit trail for exception resolution

Right now when an analyst resolves a reconciliation exception, they just
edit the exceptions CSV directly. Compliance wants something better: a way
for someone to propose a resolution with a reason and some notes, have a
different person approve or reject it, and keep a permanent record of all
of that so nothing can be quietly changed later.

Some things to keep in mind: the same person shouldn't be able to both
propose and approve their own resolution. Compliance also needs to be able
to pull an export of this history for a date range at some point. And
please don't let any actual trade amounts or account numbers end up in logs
— that's come up as a concern before.

Build this on top of the reconciliation service. Use your judgment on the
rest of the details.
