import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Merci pour votre paiement - Plan 5 appareils | SMS Gateway',
  description: 'Votre paiement a été reçu. Nous allons activer votre abonnement sous peu.',
}

export default function ThankYouPlan5() {
  const planDetails = {
    name: 'Plan Monthly - 5 appareils',
    price: '22,900 F CFA',
    features: [
      'SMS illimités',
      '5 appareils Android',
      'Statistiques en temps réel',
      'Support prioritaire VIP',
      'Multi-device management',
      'API access (bientôt)',
    ],
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-6 animate-bounce">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Paiement reçu ! 🎉
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Merci pour votre confiance
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 border-2 border-purple-500/20">
          {/* VIP Badge */}
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
              <span>👑</span> Plan VIP
            </span>
          </div>

          {/* Plan Details */}
          <div className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-2">{planDetails.name}</h2>
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {planDetails.price}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">par mois</p>
          </div>

          {/* Features */}
          <div className="mb-8">
            <h3 className="font-semibold mb-4 text-gray-700 dark:text-gray-300">
              Votre abonnement inclut :
            </h3>
            <ul className="space-y-3">
              {planDetails.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Next Steps */}
          <div className="bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-6 mb-6">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <span>📋</span> Prochaines étapes
            </h3>
            <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex gap-3">
                <span className="flex-shrink-0 font-bold text-orange-600">1.</span>
                <span>
                  <strong>Contactez-nous sur WhatsApp</strong> en cliquant sur le bouton ci-dessous
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 font-bold text-orange-600">2.</span>
                <span>
                  Envoyez-nous votre <strong>email d'inscription</strong> (celui utilisé sur smsenvoie.com)
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 font-bold text-orange-600">3.</span>
                <span>
                  Notre équipe <strong>active votre abonnement dans les 30 minutes</strong> ✅
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 font-bold text-orange-600">4.</span>
                <span>
                  Vous recevrez une <strong>confirmation par WhatsApp</strong> dès l'activation
                </span>
              </li>
            </ol>
          </div>

          {/* WhatsApp CTA */}
          <a
            href={`https://wa.me/2250778030075?text=${encodeURIComponent(
              `Bonjour ! 🎉\n\nJe viens de payer pour le *${planDetails.name}* (${planDetails.price}).\n\nMon email d'inscription : [VOTRE_EMAIL]\n\nMerci d'activer mon abonnement.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl font-bold text-lg bg-[#25D366] text-white hover:bg-[#20BA5A] transition-all shadow-lg hover:shadow-xl"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Contacter sur WhatsApp maintenant
          </a>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
            Délai d'activation : Maximum 30 minutes (souvent instantané)
          </p>
        </div>

        {/* Return to Dashboard */}
        <div className="text-center mt-8">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

