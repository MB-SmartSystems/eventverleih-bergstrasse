/**
 * Text blocks shared by several mails.
 *
 * SIGNATURE existed as a byte-identical copy in four route files. Consolidating it
 * here is not a text change — the four copies were verified identical (md5) before
 * merging. One place also means the legal footer (§ 19 UStG) can never drift apart
 * between mails.
 */

export const SIGNATURE = `\n\nMit freundlichen Grüßen\nManuel Büttner\n\nEventverleih Bergstraße\nSchlesierstraße 19a, 64665 Alsbach-Hähnlein\nTel/WhatsApp: +49 156 79521124\nE-Mail: info@eventverleih-bergstrasse.de\nWeb: eventverleih-bergstrasse.de\n\nNicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`;
