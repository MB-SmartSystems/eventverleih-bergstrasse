// Zentrale Tracking-Komponente (MB SmartSystems Standard).
//
// - Umami (cookielos, KEIN Consent-Banner nötig): aktiv, sobald
//   NEXT_PUBLIC_UMAMI_URL + NEXT_PUBLIC_UMAMI_WEBSITE_ID gesetzt sind.
// - GA4 (consent-pflichtig): nur falls NEXT_PUBLIC_GA_ID gesetzt ist — daher auf
//   reinen Umami-Seiten inaktiv. NUR auf Seiten mit aktivem Cookie-Consent setzen.
//
// ENVs sind NEXT_PUBLIC_* → werden zur Build-Zeit eingebacken (echter Rebuild nötig).

export default function Analytics() {
  const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL
  const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  const gaId = process.env.NEXT_PUBLIC_GA_ID

  return (
    <>
      {umamiUrl && umamiId && (
        <script defer src={`${umamiUrl}/script.js`} data-website-id={umamiId} />
      )}
      {gaId && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
            }}
          />
        </>
      )}
    </>
  )
}
