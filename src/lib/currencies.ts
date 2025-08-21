export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "CHF" | "CNY" | "SEK" | "NZD" | "MXN" | "SGD" | "HKD" | "NOK" | "INR" | "ZAR" | "TRY" | "BRL" | "TWD" | "DKK" | "PLN" | "THB" | "ILS" | "AED" | "CZK" | "SAR" | "MYR" | "HUF" | "CLP" | "PHP" | "COP" | "PEN" | "EGP" | "VND" | "UAH" | "ISK" | "RUB" | "KZT" | "BYN" | "GEL" | "AMD" | "AZN" | "BDT" | "PKR" | "LKR" | "NPR" | "MMK" | "KHR" | "LAK" | "NGN" | "KES" | "UGX" | "TZS" | "GHS" | "ETB" | "MAD" | "TND" | "BHD" | "JOD" | "KWD" | "LBP" | "OMR" | "QAR" | "RON" | "RSD" | "HRK" | "BGN";

export const CURRENCIES = {
  // Major currencies
  USD: { symbol: "$", name: "US Dollar" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British Pound" },
  JPY: { symbol: "¥", name: "Japanese Yen" },
  AUD: { symbol: "A$", name: "Australian Dollar" },
  CAD: { symbol: "C$", name: "Canadian Dollar" },
  CHF: { symbol: "CHF", name: "Swiss Franc" },
  CNY: { symbol: "¥", name: "Chinese Yuan" },
  INR: { symbol: "₹", name: "Indian Rupee" },
  
  // European currencies
  SEK: { symbol: "kr", name: "Swedish Krona" },
  NOK: { symbol: "kr", name: "Norwegian Krone" },
  DKK: { symbol: "kr", name: "Danish Krone" },
  PLN: { symbol: "zł", name: "Polish Zloty" },
  CZK: { symbol: "Kč", name: "Czech Koruna" },
  HUF: { symbol: "Ft", name: "Hungarian Forint" },
  RON: { symbol: "lei", name: "Romanian Leu" },
  BGN: { symbol: "лв", name: "Bulgarian Lev" },
  HRK: { symbol: "kn", name: "Croatian Kuna" },
  RSD: { symbol: "дин", name: "Serbian Dinar" },
  UAH: { symbol: "₴", name: "Ukrainian Hryvnia" },
  
  // Asia-Pacific
  SGD: { symbol: "S$", name: "Singapore Dollar" },
  HKD: { symbol: "HK$", name: "Hong Kong Dollar" },
  NZD: { symbol: "NZ$", name: "New Zealand Dollar" },
  TWD: { symbol: "NT$", name: "Taiwan Dollar" },
  KRW: { symbol: "₩", name: "South Korean Won" },
  THB: { symbol: "฿", name: "Thai Baht" },
  MYR: { symbol: "RM", name: "Malaysian Ringgit" },
  IDR: { symbol: "Rp", name: "Indonesian Rupiah" },
  PHP: { symbol: "₱", name: "Philippine Peso" },
  VND: { symbol: "₫", name: "Vietnamese Dong" },
  
  // Middle East & Africa
  AED: { symbol: "د.إ", name: "UAE Dirham" },
  SAR: { symbol: "ر.س", name: "Saudi Riyal" },
  ILS: { symbol: "₪", name: "Israeli Shekel" },
  TRY: { symbol: "₺", name: "Turkish Lira" },
  ZAR: { symbol: "R", name: "South African Rand" },
  EGP: { symbol: "ج.م", name: "Egyptian Pound" },
  
  // Americas
  BRL: { symbol: "R$", name: "Brazilian Real" },
  MXN: { symbol: "$", name: "Mexican Peso" },
  CLP: { symbol: "$", name: "Chilean Peso" },
  COP: { symbol: "$", name: "Colombian Peso" },
  PEN: { symbol: "S/", name: "Peruvian Sol" },
  
  // Additional currencies
  ISK: { symbol: "kr", name: "Icelandic Krona" },
  RUB: { symbol: "₽", name: "Russian Ruble" },
  KZT: { symbol: "₸", name: "Kazakhstani Tenge" },
  BYN: { symbol: "Br", name: "Belarusian Ruble" },
  GEL: { symbol: "₾", name: "Georgian Lari" },
  AMD: { symbol: "֏", name: "Armenian Dram" },
  AZN: { symbol: "₼", name: "Azerbaijani Manat" },
  
  // More Asian currencies
  BDT: { symbol: "৳", name: "Bangladeshi Taka" },
  PKR: { symbol: "₨", name: "Pakistani Rupee" },
  LKR: { symbol: "Rs", name: "Sri Lankan Rupee" },
  NPR: { symbol: "₨", name: "Nepalese Rupee" },
  MMK: { symbol: "K", name: "Myanmar Kyat" },
  KHR: { symbol: "៛", name: "Cambodian Riel" },
  LAK: { symbol: "₭", name: "Lao Kip" },
  
  // African currencies
  NGN: { symbol: "₦", name: "Nigerian Naira" },
  KES: { symbol: "KSh", name: "Kenyan Shilling" },
  UGX: { symbol: "USh", name: "Ugandan Shilling" },
  TZS: { symbol: "TSh", name: "Tanzanian Shilling" },
  GHS: { symbol: "₵", name: "Ghanaian Cedi" },
  ETB: { symbol: "Br", name: "Ethiopian Birr" },
  MAD: { symbol: "د.م.", name: "Moroccan Dirham" },
  TND: { symbol: "د.ت", name: "Tunisian Dinar" },
  
  // Gulf currencies
  BHD: { symbol: ".د.ب", name: "Bahraini Dinar" },
  JOD: { symbol: "د.ا", name: "Jordanian Dinar" },
  KWD: { symbol: "د.ك", name: "Kuwaiti Dinar" },
  LBP: { symbol: "ل.ل", name: "Lebanese Pound" },
  OMR: { symbol: "ر.ع.", name: "Omani Rial" },
  QAR: { symbol: "ر.ق", name: "Qatari Riyal" },
} as const;
