# Vocabulary Reminder Production Guide

Vocabloom sends opt-in Web/PWA vocabulary reminders through this path:

```text
GitHub Actions schedule -> GitHub OIDC -> Google WIF -> Firebase Admin -> named Firestore -> FCM
Dashboard test button -> Firebase ID token -> Vercel OIDC -> Google WIF -> named Firestore -> FCM
```

The Firebase target project stays on Spark. The separate Google Cloud project that owns the Workload Identity Pool must have billing enabled because Google requires billing when configuring Workload Identity Federation. Do not create or store service-account private keys for this setup.

## Fixed Firebase identifiers

- Firebase/Google Cloud project ID: `gen-lang-client-0338054309`
- Firestore database ID: `ai-studio-5ce4ff1b-cd4e-4400-b368-cedf76f6e3ea`
- Schedule timezone: `Asia/Ho_Chi_Minh`
- Slots: 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00

The project ID and database ID are different values. Every server path must set both; never rely on `(default)`.

## 1. Firebase and Web Push

1. Enable Firebase Authentication, Cloud Firestore, and Firebase Cloud Messaging in the target project.
2. In Firebase Console, open **Project settings -> Cloud Messaging -> Web Push certificates** and create or select the Web Push key pair.
3. Set only the public key as `VITE_FIREBASE_VAPID_KEY` in Vercel. Never expose a private VAPID value or service-account credential to a `VITE_*` variable.
4. Confirm the existing named database is the one receiving the Firebase free quota. Firebase grants free Firestore quota to only one database per project.
5. Deploy `firestore.rules` only after `npm run test:rules` succeeds:

   ```bash
   npm run fb
   ```

The client uses `notificationUsers/{uid}/devices/{installationId}`. Server-only state lives under `notificationDispatchStates` and `notificationTestStates`; client rules deny those paths.

## 2. Workload Identity Federation

Use a dedicated billing-enabled Google Cloud project as the identity broker. Keep the service accounts in the Firebase target project so their resource permissions are easy to audit.

### Broker project APIs

Enable these APIs in the broker project:

```bash
gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project BROKER_PROJECT_ID
```

Create one pool, for example `vocabloom-external`, with two providers:

- `github`: issuer `https://token.actions.githubusercontent.com/`
- `vercel`: team issuer `https://oidc.vercel.com/VERCEL_TEAM_SLUG`

For GitHub, map `google.subject=assertion.sub` plus `repository_id`, `repository_owner_id`, `ref`, and `job_workflow_ref`. Restrict the provider condition to the numeric repository/owner IDs, `refs/heads/main`, and:

```text
QuocDuy21-10/vibe-english/.github/workflows/vocabulary-reminder.yml@refs/heads/main
```

For Vercel, map `google.subject=assertion.sub` plus `owner_id`, `project_id`, and `environment`. Restrict the condition to the stable owner/project IDs and `environment == "production"`. Do not rely only on mutable team or project names.

Provider command template (replace every uppercase placeholder with a value copied from GitHub, Vercel, or Google Cloud; use the broker project **number** in principal identifiers):

```bash
gcloud iam workload-identity-pools create vocabloom-external \
  --project=BROKER_PROJECT_ID \
  --location=global \
  --display-name="Vocabloom external workloads"

gcloud iam workload-identity-pools providers create-oidc github \
  --project=BROKER_PROJECT_ID \
  --location=global \
  --workload-identity-pool=vocabloom-external \
  --issuer-uri=https://token.actions.githubusercontent.com/ \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.job_workflow_ref=assertion.job_workflow_ref" \
  --attribute-condition="assertion.repository_id=='GITHUB_REPOSITORY_ID' && assertion.repository_owner_id=='GITHUB_OWNER_ID' && assertion.ref=='refs/heads/main' && assertion.job_workflow_ref=='QuocDuy21-10/vibe-english/.github/workflows/vocabulary-reminder.yml@refs/heads/main'"

gcloud iam workload-identity-pools providers create-oidc vercel \
  --project=BROKER_PROJECT_ID \
  --location=global \
  --workload-identity-pool=vocabloom-external \
  --issuer-uri=https://oidc.vercel.com/VERCEL_TEAM_SLUG \
  --attribute-mapping="google.subject=assertion.sub,attribute.owner_id=assertion.owner_id,attribute.project_id=assertion.project_id,attribute.environment=assertion.environment" \
  --attribute-condition="assertion.owner_id=='VERCEL_OWNER_ID' && assertion.project_id=='VERCEL_PROJECT_ID' && assertion.environment=='production'"
```

### Target service accounts and IAM

Create two dedicated service accounts in `gen-lang-client-0338054309`:

- `vocabloom-reminder-dispatcher@gen-lang-client-0338054309.iam.gserviceaccount.com`
- `vocabloom-test-push@gen-lang-client-0338054309.iam.gserviceaccount.com`

```bash
gcloud iam service-accounts create vocabloom-reminder-dispatcher \
  --project=gen-lang-client-0338054309
gcloud iam service-accounts create vocabloom-test-push \
  --project=gen-lang-client-0338054309
```

Create a Firestore data custom role with only:

```text
datastore.databases.get
datastore.entities.get
datastore.entities.list
datastore.entities.create
datastore.entities.update
datastore.entities.delete
```

Bind it to both accounts with this IAM condition:

```text
resource.name == "projects/gen-lang-client-0338054309/databases/ai-studio-5ce4ff1b-cd4e-4400-b368-cedf76f6e3ea"
```

Create a separate FCM custom role containing `cloudmessaging.messages.create` and `resourcemanager.projects.get`, and bind it without the Firestore resource condition. Do not grant Owner, Editor, Firebase Admin, or service-agent roles.

```bash
gcloud iam roles create vocabloomNotificationFirestore \
  --project=gen-lang-client-0338054309 \
  --title="Vocabloom notification Firestore data" \
  --stage=GA \
  --permissions=datastore.databases.get,datastore.entities.get,datastore.entities.list,datastore.entities.create,datastore.entities.update,datastore.entities.delete

gcloud iam roles create vocabloomNotificationSender \
  --project=gen-lang-client-0338054309 \
  --title="Vocabloom FCM sender" \
  --stage=GA \
  --permissions=cloudmessaging.messages.create,resourcemanager.projects.get
```

For each service account, bind `vocabloomNotificationFirestore` with the named-database condition and bind `vocabloomNotificationSender` without a condition. Example for the reminder account:

```bash
gcloud projects add-iam-policy-binding gen-lang-client-0338054309 \
  --member="serviceAccount:vocabloom-reminder-dispatcher@gen-lang-client-0338054309.iam.gserviceaccount.com" \
  --role="projects/gen-lang-client-0338054309/roles/vocabloomNotificationFirestore" \
  --condition='expression=resource.name=="projects/gen-lang-client-0338054309/databases/ai-studio-5ce4ff1b-cd4e-4400-b368-cedf76f6e3ea",title=named-vocabloom-database,description=Only-the-existing-named-database'

gcloud projects add-iam-policy-binding gen-lang-client-0338054309 \
  --member="serviceAccount:vocabloom-reminder-dispatcher@gen-lang-client-0338054309.iam.gserviceaccount.com" \
  --role="projects/gen-lang-client-0338054309/roles/vocabloomNotificationSender"
```

Grant `roles/iam.workloadIdentityUser` on the reminder account only to the GitHub provider principal set, and on the test-push account only to the Vercel provider principal set.

```bash
gcloud iam service-accounts add-iam-policy-binding \
  vocabloom-reminder-dispatcher@gen-lang-client-0338054309.iam.gserviceaccount.com \
  --project=gen-lang-client-0338054309 \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/BROKER_PROJECT_NUMBER/locations/global/workloadIdentityPools/vocabloom-external/attribute.repository_id/GITHUB_REPOSITORY_ID"

gcloud iam service-accounts add-iam-policy-binding \
  vocabloom-test-push@gen-lang-client-0338054309.iam.gserviceaccount.com \
  --project=gen-lang-client-0338054309 \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/BROKER_PROJECT_NUMBER/locations/global/workloadIdentityPools/vocabloom-external/attribute.project_id/VERCEL_PROJECT_ID"
```

## 3. GitHub Actions

Workflow: `.github/workflows/vocabulary-reminder.yml`

Repository variables:

```text
GCP_PROJECT_ID=gen-lang-client-0338054309
FIRESTORE_DATABASE_ID=ai-studio-5ce4ff1b-cd4e-4400-b368-cedf76f6e3ea
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/BROKER_PROJECT_NUMBER/locations/global/workloadIdentityPools/vocabloom-external/providers/github
GCP_REMINDER_SERVICE_ACCOUNT=vocabloom-reminder-dispatcher@gen-lang-client-0338054309.iam.gserviceaccount.com
```

Create a GitHub Environment named `vocabulary-reminder-production` and configure required reviewers for manual live dispatches.

The seven cron expressions are separate so `github.event.schedule` identifies the intended window. Runs delayed by at most 90 minutes retain that window; later runs log `skipped-too-late`. The dispatcher never sends multiple catch-up notifications.

### Manual runs

- Dry run: select `dry-run`; `scheduled_at` may be blank or an ISO-8601 valid slot. It reads data but performs no writes, token deletions, or FCM sends.
- Live run: select `live`, set `confirm_live=true`, and provide a valid ISO timestamp such as `2026-10-15T08:00:00+07:00`. It is rejected if more than 90 minutes late or outside the seven slots.

GitHub log summaries distinguish FCM acceptance from actual device display. A job exits non-zero for unresolved retryable failures, missing credentials, or permission errors.

## 4. Vercel test-push endpoint

Server-only Vercel environment variables:

```text
GCP_PROJECT_ID=gen-lang-client-0338054309
FIRESTORE_DATABASE_ID=ai-studio-5ce4ff1b-cd4e-4400-b368-cedf76f6e3ea
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/BROKER_PROJECT_NUMBER/locations/global/workloadIdentityPools/vocabloom-external/providers/vercel
GCP_TEST_PUSH_SERVICE_ACCOUNT=vocabloom-test-push@gen-lang-client-0338054309.iam.gserviceaccount.com
GCP_OIDC_AUDIENCE=https://iam.googleapis.com/projects/BROKER_PROJECT_NUMBER/locations/global/workloadIdentityPools/vocabloom-external/providers/vercel
```

`POST /api/notifications/test` verifies the Firebase ID token, derives UID from it, and accepts only the current Firebase Installation ID. It fetches the FCM token from Firestore and allows three attempts per device in 15 minutes. The API never returns or logs the token.

A 200 response means FCM accepted the message request. It does not prove that the browser or operating system displayed it.

Local endpoint testing needs Google Application Default Credentials or a Vercel OIDC development context. The application does not generate a service-account key fallback.

## 5. Mobile verification

### Android Chrome/PWA

1. Serve the production build over HTTPS.
2. Enable notifications from the Dashboard.
3. Send a test while the page is foregrounded and verify one Sonner toast.
4. Put the browser/PWA in the background, send again after the rate-limit interval if necessary, and verify one OS notification.
5. Close the PWA, send again, then select the notification and confirm `/dashboard` or `/dictionary` opens.

Chrome permission, power-saving policy, service-worker lifecycle, and OEM background restrictions can delay or suppress display after FCM acceptance.

### iPhone/iPad

Standards-based Web Push is available to Home Screen web apps on iOS/iPadOS 16.4+, but Firebase does not currently list Cloud Messaging as officially supported on iOS Safari. Install Vocabloom to the Home Screen, open it from the icon, and rely on runtime feature detection. If Firebase `isSupported()` is false, Vocabloom reports the platform as unsupported instead of promising delivery.

## 6. Removing the old scheduled function

The repository no longer exports `onSchedule` and no longer contains Firebase Functions deployment configuration. If `sendVocabularyReminders` was previously deployed, inspect it first and delete it manually only after the GitHub workflow is live:

```bash
firebase functions:list
firebase functions:delete sendVocabularyReminders --region asia-southeast1
```

Do not run the delete command merely because the source was removed.

## 7. Troubleshooting

- **Workflow does not run:** confirm the workflow exists on the default branch, Actions is enabled, and scheduled workflows have not been disabled due to repository inactivity.
- **GitHub job is late:** inspect `scheduledAt`, `executedAt`, and `reason`; jobs more than 90 minutes late intentionally skip.
- **Missing OIDC credentials:** verify `id-token: write`, provider resource name, numeric claim conditions, and `roles/iam.workloadIdentityUser` on the correct service account.
- **IAM permission denied:** check the custom role and named-database condition; Firestore server clients use IAM, not client security rules.
- **Database not found:** compare `GCP_PROJECT_ID` with `FIRESTORE_DATABASE_ID`; never use `(default)`.
- **No registered devices:** enable reminders again on the exact browser/PWA installation and inspect the owner device document.
- **Invalid FCM token:** the server removes only the unchanged registration. Re-enable notifications to create a fresh token.
- **FCM accepted but no notification:** check permission, Focus/Do Not Disturb, OS power restrictions, service-worker registration/scope, installed-PWA requirements, and VAPID key consistency.
- **VAPID mismatch:** ensure the public key in Vercel matches the Web Push certificate in the same Firebase project used by the client.
- **Background push missing:** confirm the sender uses a data-only message and `firebase-messaging-sw.js` exists at the root scope.
- **Rules deployment authentication error:** run `firebase login --reauth` interactively, then rerun `npm run fb`; do not create a CI token or private key as an ad-hoc workaround.

## 8. Cost and delivery boundaries

- FCM is a no-cost Firebase product.
- Firestore Spark quota is limited and only one database in a project receives free quota; monitor reads/writes/deletes caused by each scheduled run.
- The WIF broker project requires a linked billing account even though the Firebase target can remain Spark.
- GitHub-hosted runner cost depends on repository visibility and account plan. Seven short runs per day still consume private-repository minutes.
- Vercel Hobby includes limited Function usage; exceeding the plan may pause service rather than guarantee continued free execution.
- FCM provides acceptance and message IDs, not exactly-once display. A crash after FCM acceptance but before Firestore acknowledgement may cause a duplicate on retry.

## 9. Final production verification checklist

- [ ] Confirm GitHub variables, the production Environment, both WIF providers, and both service-account bindings.
- [ ] Confirm Vercel production variables and `VITE_FIREBASE_VAPID_KEY` without storing a service-account key.
- [ ] Run `npm run test:rules` and successfully run `npm run fb` against `gen-lang-client-0338054309`.
- [ ] Deploy the Vercel application and confirm `/api/notifications/test` rejects unauthenticated requests.
- [ ] Open the HTTPS app on a phone, enable reminders, and confirm the current installation document exists.
- [ ] Press **Gửi thông báo thử** in foreground and verify exactly one Sonner toast.
- [ ] Repeat in background and closed-PWA states and verify the operating-system notification where supported.
- [ ] Select the notification and verify only `/dashboard` or `/dictionary` is opened.
- [ ] Run the GitHub workflow manually in dry-run and confirm there are no Firestore writes or FCM sends.
- [ ] Run one approved manual live dispatch inside a valid 90-minute window and inspect the structured summary.
- [ ] Rerun the same window and confirm accepted devices are not sent again.
- [ ] Log out, verify current-device cleanup, and confirm a later login requires opt-in again.
- [ ] Remove the old Firebase scheduled function only after the GitHub schedule has been observed in production.
