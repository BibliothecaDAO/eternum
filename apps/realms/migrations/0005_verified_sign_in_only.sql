-- Players sign in with Discord or an emailed code only: passkeys and anonymous sign-up are gone.
drop table "passkey";

alter table "user" drop column "isAnonymous";
