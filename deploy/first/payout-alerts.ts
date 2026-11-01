import { boxSsh } from "./box";
import { PublicError } from "./errors";
import { command, shell } from "./process";
import type { Deployment } from "./main";
import type { Step } from "./run";
import type { Target } from "./settings";

/** The owner's private Discord channel webhook, saved by the owner in the production private directory. */
export const ALERT_WEBHOOK_RECORD = "discord-alert-webhook";
const WAITING = {
  "no-cosigner": "Install and start the payout co-signer (deploy/athanor/README.md), then run setup again.",
  "old-checkout": "Update the co-signer's checkout at /opt/eternum to this commit, then run setup again.",
};
const BOX_STATES = ["installed", "missing", "no-cosigner", "old-checkout"] as const;
const DISCORD_WEBHOOK = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

/**
 * Off-Cloudflare alerts for production payouts (audit N8): the box's minute timer beside the co-signer posts held
 * wallet changes, a paused ledger and a silent co-signer to the owner's channel. Dev sends no alerts. It installs once
 * the co-signer runs, so a first setup waits here; installing posts one test message for the owner to see.
 */
export function payoutAlertSteps(context: Deployment): Step[] {
  if (context.environment !== "production") return [];
  const webhook = () => savedWebhook(context);
  return [
    {
      name: "Payout alerts",
      payer: "none",
      cost: "0 STRK",
      inspect: async () => {
        const state = await payoutAlertsOnBox(context.target, webhook(), "inspect");
        if (state !== "installed" && state !== "missing")
          return {
            done: false,
            waiting: WAITING[state],
            detail: "the alert timer runs beside the co-signer, as its user, from its checkout",
          };
        return {
          done: state === "installed",
          detail: "webhook compared on the box through standard input; units and timer checked",
        };
      },
      apply: async () => {
        await payoutAlertsOnBox(context.target, webhook(), "install");
      },
    },
  ];
}

function savedWebhook(context: Deployment) {
  const webhook = context.store.readText(ALERT_WEBHOOK_RECORD)?.trim();
  if (!webhook)
    throw new PublicError(`Save the owner's Discord webhook as ${ALERT_WEBHOOK_RECORD} in the private directory`);
  // The address is the channel's credential: the refusal names the record, never its contents.
  if (!DISCORD_WEBHOOK.test(webhook)) throw new PublicError(`${ALERT_WEBHOOK_RECORD} is not a Discord webhook address`);
  return webhook;
}

/** Runs as root on the box; the webhook travels only on encrypted standard input and is written mode 0600. */
const BOX_PROGRAM = `import hmac,os,pwd,shutil,stat,subprocess,sys
mode=sys.argv[1]; webhook=sys.stdin.read().strip()
config='/etc/payout-cosigner/config.json'; saved='/etc/payout-cosigner/discord-webhook'
checkout='/opt/eternum/deploy/athanor/cosigner/'; units=('payout-alerts.service','payout-alerts.timer')
def active(unit): return subprocess.run(['systemctl','is-active','--quiet',unit]).returncode==0
if not os.path.isfile(config) or not active('payout-cosigner.service'): print('no-cosigner'); raise SystemExit
if not all(os.path.isfile(checkout+unit) for unit in units): print('old-checkout'); raise SystemExit
user=pwd.getpwnam('payout-cosigner')
def webhook_saved():
  if not os.path.lexists(saved): return False
  s=os.lstat(saved)
  if not stat.S_ISREG(s.st_mode) or stat.S_IMODE(s.st_mode)!=0o600 or s.st_uid!=user.pw_uid: return False
  with open(saved) as f: return hmac.compare_digest(f.read().strip(),webhook)
def unit_current(unit):
  path='/etc/systemd/system/'+unit
  return os.path.isfile(path) and open(path,'rb').read()==open(checkout+unit,'rb').read()
if mode=='inspect':
  print('installed' if webhook_saved() and all(map(unit_current,units)) and active('payout-alerts.timer') else 'missing'); raise SystemExit
os.umask(0o077); temporary=saved+'.tmp'
if os.path.lexists(temporary): os.unlink(temporary)
fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
os.write(fd,(webhook+'\\n').encode()); os.fchown(fd,user.pw_uid,user.pw_gid); os.close(fd); os.replace(temporary,saved)
for unit in units:
  shutil.copyfile(checkout+unit,'/etc/systemd/system/'+unit); os.chmod('/etc/systemd/system/'+unit,0o644)
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['runuser','-u','payout-cosigner','--','/usr/local/bin/bun','deploy/athanor/cosigner/alerts.ts','test',config,saved],cwd='/opt/eternum',check=True,stdout=subprocess.DEVNULL)
subprocess.run(['systemctl','enable','--now','payout-alerts.timer'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print('installed')`;

async function payoutAlertsOnBox(target: Target, webhook: string, mode: "inspect" | "install") {
  const state = (
    await command({ argv: boxSsh(target, `sudo -n python3 -c ${shell(BOX_PROGRAM)} ${mode}`), input: webhook })
  ).trim();
  const known = BOX_STATES.find((name) => name === state);
  if (!known) throw new PublicError("The box answered the payout alert check with an unknown state");
  return known;
}
