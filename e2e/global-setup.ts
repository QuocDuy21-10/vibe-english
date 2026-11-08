import { createGoogleUser, resetEmulators, seedPopulatedAccount } from "./emulator";

export default async function globalSetup() {
  await resetEmulators();
  const session = await createGoogleUser();
  await seedPopulatedAccount(session.uid);
}
