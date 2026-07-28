export const BASE_CURRENCY = 'USD';

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  CAD: 1.36,
  SAR: 3.75,
  AED: 3.67,
  AUD: 1.53,
  PKR: 278,
  INR: 83,
  CNY: 7.24,
  JPY: 149,
  EUR: 1.08,
  GBP: 1.27,
  NZD: 1.62,
  HKD: 7.82,
  CHF: 0.89,
  NOK: 10.75,
  TRY: 32.50,
  SDG: 600,
  QAR: 3.64,
  KWD: 0.31
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', CAD: 'C$', SAR: 'ر.س', AED: 'د.إ', AUD: 'A$', PKR: '₨', INR: '₹', CNY: '¥', JPY: '¥',
  EUR: '€', GBP: '£', NZD: 'NZ$', HKD: 'HK$', CHF: 'Fr', NOK: 'kr', TRY: '₺', SDG: 'ج.س',
  QAR: 'ر.ق', KWD: 'د.ك'
};

export const ALL_CURRENCIES = ['USD', 'CAD', 'SAR', 'AED', 'AUD', 'PKR', 'INR', 'CNY', 'JPY', 'EUR', 'GBP', 'NZD', 'HKD', 'CHF', 'NOK', 'TRY', 'SDG'] as const;
export type CurrencyCode = typeof ALL_CURRENCIES[number];

export const CURRENCY_NAMES: Record<string, string> = {
  USD: 'United States Dollar',
  CAD: 'Canadian Dollar',
  SAR: 'Saudi Riyal',
  AED: 'UAE Dirham',
  AUD: 'Australian Dollar',
  PKR: 'Pakistani Rupee',
  INR: 'Indian Rupee',
  CNY: 'Chinese Yuan',
  JPY: 'Japanese Yen',
  EUR: 'Euro',
  GBP: 'British Pound',
  NZD: 'New Zealand Dollar',
  HKD: 'Hong Kong Dollar',
  CHF: 'Swiss Franc',
  NOK: 'Norwegian Krone',
  TRY: 'Turkish Lira',
  SDG: 'Sudanese Pound',
};

export interface WorldCurrency {
  code: string;
  name: string;
  symbol: string;
}

export const WORLD_CURRENCIES: WorldCurrency[] = [
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'AFN', name: 'Afghan Afghani', symbol: '؋' },
  { code: 'ALL', name: 'Albanian Lek', symbol: 'L' },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏' },
  { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'ƒ' },
  { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'AWG', name: 'Aruban Florin', symbol: 'ƒ' },
  { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼' },
  { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM' },
  { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب' },
  { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu' },
  { code: 'BMD', name: 'Bermudian Dollar', symbol: '$' },
  { code: 'BND', name: 'Brunei Dollar', symbol: 'B$' },
  { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs.' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'BSD', name: 'Bahamian Dollar', symbol: '$' },
  { code: 'BTN', name: 'Bhutanese Ngultrum', symbol: 'Nu.' },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P' },
  { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br' },
  { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CDF', name: 'Congolese Franc', symbol: 'FC' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$' },
  { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡' },
  { code: 'CUP', name: 'Cuban Peso', symbol: '₱' },
  { code: 'CVE', name: 'Cape Verdean Escudo', symbol: 'Esc' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$' },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£' },
  { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk' },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$' },
  { code: 'FKP', name: 'Falkland Islands Pound', symbol: '£' },
  { code: 'FOK', name: 'Faroese Króna', symbol: 'kr' },
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£' },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾' },
  { code: 'GGP', name: 'Guernsey Pound', symbol: '£' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'GIP', name: 'Gibraltar Pound', symbol: '£' },
  { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D' },
  { code: 'GNF', name: 'Guinean Franc', symbol: 'FG' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q' },
  { code: 'GYD', name: 'Guyanese Dollar', symbol: '$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'HNL', name: 'Honduran Lempira', symbol: 'L' },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn' },
  { code: 'HTG', name: 'Haitian Gourde', symbol: 'G' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪' },
  { code: 'IMP', name: 'Isle of Man Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د' },
  { code: 'IRR', name: 'Iranian Rial', symbol: '﷼' },
  { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr' },
  { code: 'JEP', name: 'Jersey Pound', symbol: '£' },
  { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$' },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'KGS', name: 'Kyrgyzstani Som', symbol: 'с' },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛' },
  { code: 'KID', name: 'Kiribati Dollar', symbol: '$' },
  { code: 'KMF', name: 'Comorian Franc', symbol: 'CF' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
  { code: 'KYD', name: 'Cayman Islands Dollar', symbol: '$' },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸' },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭' },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨' },
  { code: 'LRD', name: 'Liberian Dollar', symbol: '$' },
  { code: 'LSL', name: 'Lesotho Loti', symbol: 'L' },
  { code: 'LYD', name: 'Libyan Dinar', symbol: 'ل.د' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.' },
  { code: 'MDL', name: 'Moldovan Leu', symbol: 'L' },
  { code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar' },
  { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден' },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'Ks' },
  { code: 'MNT', name: 'Mongolian Tögrög', symbol: '₮' },
  { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$' },
  { code: 'MRU', name: 'Mauritanian Ouguiya', symbol: 'UM' },
  { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨' },
  { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'Rf' },
  { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT' },
  { code: 'NAD', name: 'Namibian Dollar', symbol: '$' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.' },
  { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.' },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/' },
  { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'PYG', name: 'Paraguayan Guaraní', symbol: '₲' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'SBD', name: 'Solomon Islands Dollar', symbol: '$' },
  { code: 'SCR', name: 'Seychellois Rupee', symbol: '₨' },
  { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'SHP', name: 'Saint Helena Pound', symbol: '£' },
  { code: 'SLL', name: 'Sierra Leonean Leone', symbol: 'Le' },
  { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh' },
  { code: 'SRD', name: 'Surinamese Dollar', symbol: '$' },
  { code: 'SSP', name: 'South Sudanese Pound', symbol: '£' },
  { code: 'STN', name: 'São Tomé and Príncipe Dobra', symbol: 'Db' },
  { code: 'SYP', name: 'Syrian Pound', symbol: '£' },
  { code: 'SZL', name: 'Eswatini Lilangeni', symbol: 'L' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'ЅМ' },
  { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'm' },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت' },
  { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'TTD', name: 'Trinidad and Tobago Dollar', symbol: 'TT$' },
  { code: 'TVD', name: 'Tuvaluan Dollar', symbol: '$' },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'Sh' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'Sh' },
  { code: 'USD', name: 'United States Dollar', symbol: '$' },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$' },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm' },
  { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs.' },
  { code: 'VND', name: 'Vietnamese Đồng', symbol: '₫' },
  { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT' },
  { code: 'WST', name: 'Samoan Tālā', symbol: 'WS$' },
  { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA' },
  { code: 'XCD', name: 'East Caribbean Dollar', symbol: '$' },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA' },
  { code: 'XPF', name: 'CFP Franc', symbol: '₣' },
  { code: 'YER', name: 'Yemeni Rial', symbol: '﷼' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK' },
  { code: 'ZWL', name: 'Zimbabwean Gold', symbol: 'ZiG' },
];

export interface CustomCurrency {
  code: string;
  symbol: string;
}

export function getAllCurrencies(customCurrencies: CustomCurrency[]): string[] {
  const builtIn = [...ALL_CURRENCIES];
  for (const cc of customCurrencies) {
    if (!builtIn.includes(cc.code as any)) {
      builtIn.push(cc.code);
    }
  }
  return builtIn;
}

export function getCurrencySymbol(code: string, customCurrencies: CustomCurrency[]): string {
  if (CURRENCY_SYMBOLS[code]) return CURRENCY_SYMBOLS[code];
  const found = customCurrencies.find(c => c.code === code);
  return found?.symbol || code;
}

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, rates?: Record<string, number>): number {
  const effectiveRates = rates || DEFAULT_EXCHANGE_RATES;
  const normalizedFrom = normalizeCurrency(fromCurrency);
  const normalizedTo = normalizeCurrency(toCurrency);

  const rateFrom = effectiveRates[normalizedFrom] || 1;
  const rateTo = effectiveRates[normalizedTo] || 1;

  return amount * (rateTo / rateFrom);
}

function normalizeCurrency(raw: string): string {
  if (raw === '₨') return 'PKR';
  if (raw === '$') return 'USD';
  const entry = Object.entries(CURRENCY_SYMBOLS).find(([, sym]) => sym === raw);
  return entry ? entry[0] : raw;
}

export function convertToBase(amount: number, fromCurrency: string, rates?: Record<string, number>): number {
  const effectiveRates = rates || DEFAULT_EXCHANGE_RATES;
  const storedSymbol = localStorage.getItem('clearsum_base_currency') || 'USD';
  const normalizedBase = normalizeCurrency(storedSymbol);
  const normalizedFrom = normalizeCurrency(fromCurrency);
  if (normalizedFrom === normalizedBase) return amount;
  return convertCurrency(amount, normalizedFrom, normalizedBase, effectiveRates);
}

