# Operator job measurements

Use this small private ledger to record the PRD's actual job costs and human
publishability judgments. It adds no customer form or analytics service.
Records and invoice references stay in ignored `.local/job-measurements/`.
Keep an approved private backup: ignored local files are not preserved by Git,
and the optional database audit disappears with normal job retention.

The default command is offline and makes no changes:

```powershell
node --import tsx scripts/job-measurements.ts
node --import tsx scripts/job-measurements.ts --phase init --job JOB-UUID --owner OWNER-UUID
```

`init` creates one local JSON file without overwriting an existing record. Copy
the exact job and owner IDs from trusted job records. Offline validation does not
claim to verify ownership. The exported `measurementSchema` in
`scripts/job-measurements.ts` is the record contract. Edit the generated JSON;
do not put API keys, session tokens, full invoice documents, or unnecessary
personal information in it.

## Costs

Every record covers **all attempts of one job**, including failed requests and
recovered workers. Four required components begin with `amountUsd: null` and
`evidence: null`: `model`, `audioAndTranscription`, `compute`, and
`storageAndDelivery`. The last category includes attributable hosting functions,
storage and delivery charges. Do not silently omit a billable component.

Only enter a known component after inspecting actual billing evidence. Amounts
are USD decimal **strings**, with at most six decimal places. Each known amount,
including zero, requires `provider`, `invoiceReference`, `lineReference`,
`allocationMethod`, `reviewedBy`, and ISO-8601 `reviewedAt` in its `evidence`.
References identify securely retained invoice rows and the supporting provider
request IDs, usage records, or Sandbox attempts; they do not upload those files.
Explain any invoice-backed allocation of shared charges. Listed rates, estimated
tokens, an unused allowance, or a missing invoice are not actual charges. If a
component cannot yet be attributed honestly, leave it null. Do not guess exchange
rates; use verified USD settlement evidence or retain the unknown value.

`report` shows the known subtotal separately. The **actual total stays null until
all four components have evidence**. No example prices or dollar promises are
supplied by this workflow.

## Publishability

Leave `publishability` null until someone actually reviews the final downloaded
MP4. A judgment contains `judgment` (`publishable`, `minor_changes`, or
`not_publishable`), `reviewerKind` (`tester` or `operator`), `reviewedBy`,
`reviewedAt`, `evidenceReference`, and `notes`. Record the person's actual
assessment and its source. Operator inspection and model QC are not tester
feedback. This judgment never changes job readiness or replaces required QC.

```powershell
node --import tsx scripts/job-measurements.ts --phase validate --file JOB-UUID.json
node --import tsx scripts/job-measurements.ts --phase report --file JOB-UUID.json
```

These commands read local records only and need no credentials. Review their
summary and the underlying invoice/review references before reconciliation.

## Optional database reconciliation

Only an authorized operator may run the following explicit write. Preparation
and tests have not performed this action, and command flags do not substitute
for authorization.

```powershell
node --env-file=.env.local --import tsx scripts/job-measurements.ts --phase apply --file JOB-UUID.json --job JOB-UUID --owner OWNER-UUID --apply
```

The supplied IDs must match the record. A single conditional update also checks
the exact database owner and requires a terminal state: `ready`, `failed`,
`needs_input`, `needs_review`, or `cancelled`. Active jobs cannot be reconciled.
An invoice-backed complete total fills `studio_jobs.cost_usd`; unknown totals
leave its current value unchanged. A human judgment may be recorded while cost
is unknown. An existing different known total is rejected for separate operator
review rather than silently replaced.

Before the database call, the script retains the exact record and its SHA-256
under `audit/`. The same record, hash and application timestamp are appended to
the job's `checkpoint.operatorMeasurements`; a successful response creates a
local receipt. Repeating the identical record is idempotent. If a response is
lost, preserve the audit and retry only that exact reviewed record. The script
never changes quality checks, ready/failed state, owner, allowances, or media.

Completion/failure counts, elapsed times, quality findings and repeat submissions
already exist in job records and user submission counts. This ledger supplies
the missing invoice reconciliation and explicitly attributed human assessment;
it does not infer publishability or return intent from usage.

Offline tests cover schema rules, exact decimal totals, CLI gating, audit-before-
query ordering, parameters, and failure/receipt behavior through a mocked query.
They do not execute SQL or certify database ownership, terminal-state or
idempotency enforcement. No live reconciliation has been performed by setup.
