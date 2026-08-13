import Link from 'next/link'

export const metadata = {
  title: 'Documentation API - SMSenvoie',
  description:
    'API REST SMSenvoie : envoyez des SMS depuis vos applications, votre boutique e-commerce ou vos outils de relance client via votre telephone Android.',
}

const BASE_URL = 'https://smsenvoie.com/api/v1'

const sections = [
  { id: 'intro', label: 'Introduction' },
  { id: 'auth', label: 'Authentification' },
  { id: 'send', label: 'Envoyer des SMS' },
  { id: 'sms-status', label: "Statut d'un message" },
  { id: 'sms-list', label: 'Lister les messages' },
  { id: 'campaigns', label: 'Campagnes' },
  { id: 'devices', label: 'Appareils' },
  { id: 'quota', label: 'Quota & plan' },
  { id: 'errors', label: "Codes d'erreur" },
  { id: 'examples', label: 'Exemples de code' },
  { id: 'use-cases', label: "Cas d'usage" },
  { id: 'security', label: 'Securite & bonnes pratiques' },
]

function Code({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border my-4">
      {title && (
        <div className="bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
          {title}
        </div>
      )}
      <pre className="bg-slate-950 text-slate-100 p-4 text-sm overflow-x-auto leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  )
}

function Method({ method, path }: { method: 'GET' | 'POST'; path: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <span
        className={`px-3 py-1 rounded-md text-xs font-bold font-mono ${
          method === 'GET' ? 'bg-blue-500/15 text-blue-600' : 'bg-green-500/15 text-green-600'
        }`}
      >
        {method}
      </span>
      <code className="text-sm font-mono font-semibold text-foreground">{path}</code>
    </div>
  )
}

function ParamTable({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-muted text-left">
            <th className="px-4 py-2.5 font-semibold text-foreground">Parametre</th>
            <th className="px-4 py-2.5 font-semibold text-foreground">Type</th>
            <th className="px-4 py-2.5 font-semibold text-foreground">Requis</th>
            <th className="px-4 py-2.5 font-semibold text-foreground">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(([name, type, req, desc]) => (
            <tr key={name}>
              <td className="px-4 py-2.5 font-mono text-primary">{name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{type}</td>
              <td className="px-4 py-2.5">
                {req === 'oui' ? (
                  <span className="text-destructive font-medium">oui</span>
                ) : (
                  <span className="text-muted-foreground">non</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-lg">📱</div>
            <div>
              <span className="font-semibold text-lg text-primary">SMSenvoie</span>
              <span className="text-xs text-muted-foreground ml-2">Documentation API</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold font-mono">
              v1
            </span>
            <Link
              href="/dashboard/api-keys"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Obtenir une clef API
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 lg:flex lg:gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sommaire</p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-3xl space-y-16">
          {/* ── INTRO ── */}
          <section id="intro">
            <h1 className="text-3xl font-bold text-foreground mb-4">API SMSenvoie</h1>
            <p className="text-muted-foreground leading-relaxed mb-4">
              L'API SMSenvoie permet a vos applications, votre boutique e-commerce ou vos outils internes
              d'envoyer des SMS <strong className="text-foreground">via votre propre telephone Android</strong> et votre SIM.
              Pas de cout par SMS chez un tiers : les messages partent avec votre forfait mobile,
              en utilisant votre appareil connecte comme passerelle.
            </p>
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <p className="text-sm text-foreground">
                <span className="font-semibold">URL de base :</span>{' '}
                <code className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{BASE_URL}</code>
              </p>
              <p className="text-sm text-muted-foreground">
                Toutes les reponses sont en JSON. Les requetes doivent inclure le header{' '}
                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Content-Type: application/json</code>.
              </p>
            </div>

            <h3 className="text-lg font-semibold text-foreground mt-8 mb-3">Comment ca marche ?</h3>
            <ol className="space-y-2 text-muted-foreground text-sm list-decimal list-inside">
              <li>Installez l'app <strong className="text-foreground">SMSenvoie</strong> sur votre telephone Android et appairez-le (QR code).</li>
              <li>Generez une clef API depuis votre <Link href="/dashboard/api-keys" className="text-primary hover:underline">dashboard</Link>.</li>
              <li>Appelez <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">POST /api/v1/sms</code> depuis votre application.</li>
              <li>Votre telephone recoit la file d'attente et envoie les SMS automatiquement (anti-spam integre : delais aleatoires, variation du texte).</li>
              <li>Suivez les statuts en temps reel via l'API ou le dashboard web.</li>
            </ol>
          </section>

          {/* ── AUTH ── */}
          <section id="auth">
            <h2 className="text-2xl font-bold text-foreground mb-4">Authentification</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-2">
              Toutes les requetes necessitent une clef API transmise dans le header{' '}
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Authorization</code> :
            </p>
            <Code title="Header d'authentification">{`Authorization: Bearer sk_live_votre_clef_secrete`}</Code>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Creez vos clefs depuis <Link href="/dashboard/api-keys" className="text-primary hover:underline">Dashboard → Clefs API</Link>.
              Chaque clef est liee a votre organisation et herite de vos quotas et appareils.
              La clef complete n'est affichee qu'<strong className="text-foreground">une seule fois</strong> a la creation.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mt-4 text-sm text-foreground">
              ⚠️ Gardez vos clefs secretes : ne les exposez jamais dans du code cote client (navigateur, app mobile publique),
              dans un depot Git public ou dans des URLs. Utilisez-les uniquement cote serveur.
            </div>

            <h3 className="text-base font-semibold text-foreground mt-6 mb-3">Gerer vos clefs</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Creer</strong> : Dashboard → Clefs API → « + Nouvelle clef ». Donnez-lui un nom parlant (ex. « Boutique Shopify »).</li>
              <li><strong className="text-foreground">Suivre</strong> : le dashboard affiche le prefixe de chaque clef et sa derniere date d'utilisation.</li>
              <li>
                <strong className="text-foreground">Revoquer</strong> : bouton « Revoquer » a cote de la clef. La revocation est{' '}
                <strong className="text-foreground">immediate et definitive</strong> : la clef est verifiee a chaque requete
                (aucun cache), elle renvoie instantanement <code className="font-mono text-xs bg-muted px-1 rounded">401 invalid_api_key</code>{' '}
                et ne peut pas etre reactivee — il faut en creer une nouvelle.
              </li>
            </ul>
          </section>

          {/* ── SEND ── */}
          <section id="send">
            <h2 className="text-2xl font-bold text-foreground mb-4">Envoyer des SMS</h2>
            <Method method="POST" path="/api/v1/sms" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              Envoie un SMS a un ou plusieurs destinataires (jusqu'a 1 000 par requete).
              Les numeros sont normalises automatiquement au format international (E.164) —
              les numeros locaux ivoiriens a 8-10 chiffres sont prefixes de <code className="font-mono text-xs bg-muted px-1 rounded">+225</code>.
              Les numeros de votre liste noire (STOP) sont exclus automatiquement.
            </p>

            <h3 className="text-base font-semibold text-foreground mt-6">Parametres du body (JSON)</h3>
            <ParamTable
              rows={[
                ['to', 'string | string[]', 'oui', 'Numero(s) destinataire(s). Ex: "+2250707000000" ou ["+22507...", "+22505..."]'],
                ['message', 'string', 'oui', 'Texte du SMS'],
                ['messages', 'string[]', 'non', 'Variantes du texte (anti-spam) : chaque destinataire recoit une variante au hasard'],
                ['name', 'string', 'non', 'Nom de la campagne creee (defaut: "API - date")'],
                ['device_id', 'string', 'non', "Forcer l'envoi via un appareil precis (voir GET /devices)"],
                ['sim_slot', 'number', 'non', 'Slot SIM a utiliser (0 ou 1) sur un appareil double SIM'],
                ['priority', 'number', 'non', 'Priorite : 0 = normale (defaut), 1 = haute, 2 = urgente'],
              ]}
            />

            <Code title="Envoi simple (cURL)">{`curl -X POST ${BASE_URL}/sms \\
  -H "Authorization: Bearer sk_live_votre_clef" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+2250707000000",
    "message": "Votre commande #4521 est confirmee. Merci !"
  }'`}</Code>

            <Code title="Envoi en masse avec variantes anti-spam">{`curl -X POST ${BASE_URL}/sms \\
  -H "Authorization: Bearer sk_live_votre_clef" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": ["+2250707000001", "+2250505000002", "+2250101000003"],
    "message": "Bonjour {client}, votre colis arrive demain.",
    "messages": [
      "Bonjour {client}, votre colis sera livre demain.",
      "Cher {client}, livraison de votre colis prevue demain."
    ],
    "name": "Relance livraisons - aout",
    "priority": 1
  }'`}</Code>

            <Code title="Reponse 200">{`{
  "ok": true,
  "campaign_id": "c3f2a1b0-....",
  "total": 3,
  "skipped_optout": 0,
  "invalid": 0,
  "status": "queued"
}`}</Code>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-foreground">
              💡 Les SMS sont mis en file d'attente (<code className="font-mono text-xs bg-muted px-1 rounded">queued</code>)
              puis envoyes automatiquement par votre telephone en quelques secondes, avec des delais aleatoires anti-spam
              pour proteger votre SIM du blocage operateur.
            </div>
          </section>

          {/* ── SMS STATUS ── */}
          <section id="sms-status">
            <h2 className="text-2xl font-bold text-foreground mb-4">Statut d'un message</h2>
            <Method method="GET" path="/api/v1/sms/{message_id}" />
            <p className="text-muted-foreground text-sm">
              Recupere le statut en temps reel d'un message precis.
            </p>
            <Code title="Reponse 200">{`{
  "ok": true,
  "message": {
    "id": "9a1b2c3d-....",
    "campaign_id": "c3f2a1b0-....",
    "to_phone_e164": "+2250707000000",
    "body_final": "Votre commande #4521 est confirmee. Merci !",
    "status": "sent",
    "try_count": 1,
    "last_error": null,
    "created_at": "2026-08-06T14:00:00Z",
    "sent_at": "2026-08-06T14:00:12Z"
  }
}`}</Code>
            <h3 className="text-base font-semibold text-foreground mt-4">Statuts possibles</h3>
            <ParamTable
              rows={[
                ['queued', '-', '-', "En file d'attente, en attente du telephone"],
                ['sending', '-', '-', "En cours d'envoi par l'appareil"],
                ['sent', '-', '-', 'Envoye avec succes (confirmation reelle du reseau)'],
                ['failed', '-', '-', 'Echec envoi (voir last_error)'],
                ['skipped_optout', '-', '-', 'Ignore : numero dans la liste noire'],
              ]}
            />
          </section>

          {/* ── SMS LIST ── */}
          <section id="sms-list">
            <h2 className="text-2xl font-bold text-foreground mb-4">Lister les messages</h2>
            <Method method="GET" path="/api/v1/sms" />
            <ParamTable
              rows={[
                ['page', 'number', 'non', 'Numero de page (defaut: 1)'],
                ['limit', 'number', 'non', 'Resultats par page, max 100 (defaut: 20)'],
                ['status', 'string', 'non', 'Filtrer par statut : queued, sending, sent, failed, skipped_optout'],
                ['campaign_id', 'string', 'non', 'Filtrer par campagne'],
                ['phone', 'string', 'non', 'Recherche sur le numero (partielle)'],
              ]}
            />
            <Code>{`curl "${BASE_URL}/sms?status=sent&limit=50" \\
  -H "Authorization: Bearer sk_live_votre_clef"`}</Code>
            <Code title="Reponse 200">{`{
  "ok": true,
  "messages": [ { "id": "...", "to_phone_e164": "+225...", "status": "sent", ... } ],
  "total": 128,
  "page": 1,
  "limit": 50
}`}</Code>
          </section>

          {/* ── CAMPAIGNS ── */}
          <section id="campaigns">
            <h2 className="text-2xl font-bold text-foreground mb-4">Campagnes</h2>
            <Method method="GET" path="/api/v1/campaigns" />
            <p className="text-muted-foreground text-sm mb-2">
              Liste vos campagnes (celles creees via l'API comme via le dashboard).
              Parametres : <code className="font-mono text-xs bg-muted px-1 rounded">page</code>,{' '}
              <code className="font-mono text-xs bg-muted px-1 rounded">limit</code> (max 50),{' '}
              <code className="font-mono text-xs bg-muted px-1 rounded">status</code>.
            </p>

            <Method method="GET" path="/api/v1/campaigns/{campaign_id}" />
            <p className="text-muted-foreground text-sm">
              Detail d'une campagne avec le nombre de messages par statut — ideal pour suivre une relance.
            </p>
            <Code title="Reponse 200">{`{
  "ok": true,
  "campaign": {
    "id": "c3f2a1b0-....",
    "name": "Relance livraisons - aout",
    "status": "running",
    "total_count": 150,
    "sent_count": 87,
    ...
  },
  "message_stats": {
    "queued": 55,
    "sent": 87,
    "failed": 8
  }
}`}</Code>
          </section>

          {/* ── DEVICES ── */}
          <section id="devices">
            <h2 className="text-2xl font-bold text-foreground mb-4">Appareils</h2>
            <Method method="GET" path="/api/v1/devices" />
            <p className="text-muted-foreground text-sm">
              Liste vos telephones connectes avec leur statut en ligne.
              Utilisez <code className="font-mono text-xs bg-muted px-1 rounded">device_id</code> dans
              l'envoi pour forcer un appareil precis (utile avec plusieurs SIM ou plusieurs boutiques).
            </p>
            <Code title="Reponse 200">{`{
  "ok": true,
  "devices": [
    {
      "id": "d4e5f6a7-....",
      "name": "Samsung Boutique",
      "online": true,
      "last_seen_at": "2026-08-06T14:39:55Z",
      "created_at": "2026-07-01T10:00:00Z"
    }
  ]
}`}</Code>
          </section>

          {/* ── QUOTA ── */}
          <section id="quota">
            <h2 className="text-2xl font-bold text-foreground mb-4">Quota & plan</h2>
            <Method method="GET" path="/api/v1/quota" />
            <p className="text-muted-foreground text-sm">
              Retourne votre plan actif, les SMS utilises ce mois et le quota restant.
              Utile pour verifier votre capacite avant un envoi en masse.
            </p>
            <Code title="Reponse 200">{`{
  "ok": true,
  "plan": {
    "id": "monthly_1",
    "name": "Monthly 1",
    "max_devices": 1,
    "sms_quota_month": 0
  },
  "sms_used_this_month": 342,
  "quota_remaining": null
}`}</Code>
            <p className="text-muted-foreground text-xs mt-2">
              <code className="font-mono bg-muted px-1 rounded">quota_remaining: null</code> = illimite
              (plan mensuel). Sur le plan Gratuit : <code className="font-mono bg-muted px-1 rounded">sms_quota_month = 100</code>.
            </p>
          </section>

          {/* ── ERRORS ── */}
          <section id="errors">
            <h2 className="text-2xl font-bold text-foreground mb-4">Codes d'erreur</h2>
            <ParamTable
              rows={[
                ['401 invalid_api_key', '-', '-', 'Clef API manquante, invalide ou revoquee'],
                ['400 missing_to', '-', '-', 'Parametre "to" absent'],
                ['400 missing_message', '-', '-', 'Parametre "message" absent'],
                ['400 too_many_recipients', '-', '-', 'Plus de 1 000 destinataires dans une requete'],
                ['400 no_valid_recipient', '-', '-', 'Aucun numero valide apres normalisation'],
                ['400 all_opted_out', '-', '-', 'Tous les destinataires sont dans la liste noire'],
                ['403 quota_exceeded', '-', '-', 'Quota SMS mensuel epuise'],
                ['404 device_not_found', '-', '-', 'device_id inexistant dans votre organisation'],
                ['404 not_found', '-', '-', 'Message ou campagne introuvable'],
                ['500 server_error', '-', '-', 'Erreur interne — reessayez ou contactez le support'],
              ]}
            />
            <Code title="Format d'une erreur">{`{
  "ok": false,
  "error": "Quota SMS epuise. Passez a un plan superieur.",
  "code": "quota_exceeded"
}`}</Code>
          </section>

          {/* ── EXAMPLES ── */}
          <section id="examples">
            <h2 className="text-2xl font-bold text-foreground mb-4">Exemples de code</h2>

            <Code title="JavaScript / Node.js (fetch)">{`const API_KEY = process.env.SMSENVOIE_API_KEY;

async function sendSms(to, message) {
  const res = await fetch('${BASE_URL}/sms', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, message }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(\`SMSenvoie: \${data.error}\`);
  return data; // { campaign_id, total, ... }
}

// Notification de commande
await sendSms('+2250707000000', 'Votre commande #4521 est confirmee. Merci !');`}</Code>

            <Code title="PHP (cURL) — parfait pour WooCommerce / PrestaShop">{`<?php
function sendSms($to, $message) {
  $ch = curl_init('${BASE_URL}/sms');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
      'Authorization: Bearer ' . getenv('SMSENVOIE_API_KEY'),
      'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode(['to' => $to, 'message' => $message]),
  ]);
  $response = json_decode(curl_exec($ch), true);
  curl_close($ch);
  return $response;
}

// Confirmation de commande
sendSms('+2250707000000', 'Votre commande #4521 est confirmee. Merci !');
?>`}</Code>

            <Code title="Python (requests)">{`import os, requests

API_KEY = os.environ['SMSENVOIE_API_KEY']

def send_sms(to, message):
    res = requests.post(
        '${BASE_URL}/sms',
        headers={'Authorization': f'Bearer {API_KEY}'},
        json={'to': to, 'message': message},
        timeout=30,
    )
    data = res.json()
    if not data.get('ok'):
        raise Exception(f"SMSenvoie: {data.get('error')}")
    return data

# Rappel de rendez-vous
send_sms('+2250707000000', 'Rappel : votre rendez-vous est demain a 10h.')`}</Code>
          </section>

          {/* ── USE CASES ── */}
          <section id="use-cases">
            <h2 className="text-2xl font-bold text-foreground mb-4">Cas d'usage</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-2xl mb-2">🛒</p>
                <h3 className="font-semibold text-foreground mb-2">E-commerce</h3>
                <p className="text-sm text-muted-foreground">
                  Confirmations de commande, notifications de livraison, codes promo.
                  Connectez WooCommerce, PrestaShop ou Shopify via un plugin ou un webhook
                  qui appelle <code className="font-mono text-xs bg-muted px-1 rounded">POST /sms</code> a chaque evenement.
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-2xl mb-2">📞</p>
                <h3 className="font-semibold text-foreground mb-2">Relance client</h3>
                <p className="text-sm text-muted-foreground">
                  Relances de paiement, rappels de rendez-vous, paniers abandonnes.
                  Envoyez par lots avec variantes anti-spam et suivez les statuts via{' '}
                  <code className="font-mono text-xs bg-muted px-1 rounded">GET /campaigns/{'{id}'}</code>.
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-2xl mb-2">🔐</p>
                <h3 className="font-semibold text-foreground mb-2">OTP & verification</h3>
                <p className="text-sm text-muted-foreground">
                  Codes de verification 2FA pour votre propre SaaS : generez le code chez vous,
                  envoyez-le via l'API, verifiez-le dans votre application.
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-2xl mb-2">🏢</p>
                <h3 className="font-semibold text-foreground mb-2">Notifications internes</h3>
                <p className="text-sm text-muted-foreground">
                  Alertes serveur, rapports quotidiens, notifications metier de vos outils internes
                  vers les telephones de votre equipe.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECURITY ── */}
          <section id="security">
            <h2 className="text-2xl font-bold text-foreground mb-4">Securite & bonnes pratiques</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span>🔒</span>
                <span><strong className="text-foreground">Clefs hachees.</strong> SMSenvoie ne stocke que le hash SHA-256 de votre clef. Personne — pas meme nous — ne peut la retrouver. En cas de perte, revoquez-la et creez-en une nouvelle. Une clef revoquee est bloquee immediatement et de facon definitive : la verification est faite a chaque requete, sans cache.</span>
              </li>
              <li className="flex gap-3">
                <span>🖥️</span>
                <span><strong className="text-foreground">Serveur uniquement.</strong> Appelez l'API depuis votre backend, jamais depuis le navigateur ou une app distribuee. Stockez la clef en variable d'environnement.</span>
              </li>
              <li className="flex gap-3">
                <span>🗝️</span>
                <span><strong className="text-foreground">Une clef par application.</strong> Creez une clef distincte par integration (boutique, CRM, script) : vous pourrez revoquer l'une sans casser les autres.</span>
              </li>
              <li className="flex gap-3">
                <span>🚫</span>
                <span><strong className="text-foreground">Liste noire respectee.</strong> Les destinataires ayant repondu STOP sont exclus automatiquement de tous les envois, y compris via l'API.</span>
              </li>
              <li className="flex gap-3">
                <span>🛡️</span>
                <span><strong className="text-foreground">Anti-spam integre.</strong> Les envois passent par les delais aleatoires et pauses par lot de l'app Android pour proteger votre SIM. Envoyez des volumes raisonnables et des messages personnalises.</span>
              </li>
              <li className="flex gap-3">
                <span>📊</span>
                <span><strong className="text-foreground">Quota.</strong> Verifiez <code className="font-mono text-xs bg-muted px-1 rounded">GET /quota</code> avant un envoi massif. Les requetes au-dela du quota sont rejetees avec <code className="font-mono text-xs bg-muted px-1 rounded">quota_exceeded</code>.</span>
              </li>
            </ul>
          </section>

          {/* CTA */}
          <section className="bg-primary/5 border border-primary/20 rounded-xl p-8 text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">Pret a integrer ?</h2>
            <p className="text-muted-foreground text-sm mb-5">
              Generez votre premiere clef API et envoyez votre premier SMS en moins de 5 minutes.
            </p>
            <Link
              href="/dashboard/api-keys"
              className="inline-block px-6 py-3 rounded-lg font-medium bg-primary text-primary-foreground hover:opacity-90 transition shadow-sm"
            >
              Creer ma clef API →
            </Link>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© 2026 SMSenvoie — API v1</p>
          <div className="flex gap-5">
            <Link href="/" className="hover:text-foreground transition">Accueil</Link>
            <Link href="/dashboard" className="hover:text-foreground transition">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
