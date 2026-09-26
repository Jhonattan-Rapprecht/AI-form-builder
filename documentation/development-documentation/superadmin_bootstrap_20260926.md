# Initial Super Administrator Bootstrap

The initial Super Administrator is created through a local operator-run bootstrap command so platform access cannot be claimed through a public registration page. There is no public Super Administrator registration route.

Run `npm run create-superadmin` from the project root. Enter the account email when prompted, then enter and confirm a password of at least 12 characters at the hidden terminal prompts. The password is hashed with bcrypt before it is stored. The command creates an active user, a `local` authentication identity, and a `SUPER_ADMIN` platform-role assignment in one database transaction; it does not create an organization membership.

Running the command again does not create another initial Super Administrator or change an existing password. Once the authenticated Super Administrator dashboard exists, additional Super Administrators should be managed there rather than through the bootstrap command.