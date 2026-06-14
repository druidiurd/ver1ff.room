import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { AppStore } from '../store';
import { HttpClient } from '@angular/common/http';
import { MrzGenResult } from '../store';

interface Country { code: string; name: string; }

interface ManualInfo {
  docNumFormat: string;
  docNumPrefix?: string;
  docNumPrefixOptions?: string[];
  persNumFormat?: string;
  validity: number;
  fonts: string[];
  note?: string;
}

const MANUAL_DATA: Record<string, ManualInfo> = {
  DEU: {
    docNumFormat: 'C/F/G/H/J/K + 8 alphanum (e.g. C01X00T47)',
    docNumPrefix: undefined,
    persNumFormat: 'Steueridentifikationsnummer: 11 digits, first ≠ 0',
    validity: 10,
    fonts: ['OCR-B 10 BT', 'PERFO_GERMANY', 'GERMANY_DOC'],
    note: 'First character restricted to: C F G H J K. Remaining 8: 0-9 C F G H J K L M N P R T V W X Y Z',
  },
  FRA: {
    docNumFormat: 'Regional prefix (CA/CK/DE/CH/BE/AD/CP/CT/CL/FD) + 5D + 2D',
    docNumPrefixOptions: ['CA','CK','DE','CH','BE','AD','CP','CT','CL','FD'],
    persNumFormat: 'INSEE: sex(1) + YY + MM + dept(2) + commune(3) + order(3) + key(2) = 15 digits',
    validity: 10,
    fonts: ['OCR-B-Letterpress-M-OT', 'ID_FR Regular', 'PERFO_GEORGIA'],
    note: 'Document number: 9 chars total. Prefix = issuing office code.',
  },
  NLD: {
    docNumFormat: '3L + 6D (e.g. NKF81R2T6), with check digit',
    persNumFormat: 'BSN: 9 digits, passes 11-proof check',
    validity: 10,
    fonts: ['OCRB10PITCHBT REGULAR', 'Perfo_Netherlands', 'Perfo_Netherlands_NEW', 'Meiryo UI W53'],
    note: 'Passport number follows format used since 2014. BSN is printed on data page.',
  },
  POL: {
    docNumFormat: '3L + 6D (e.g. EAP123456)',
    persNumFormat: 'PESEL: YYMMDD + 3D(seq) + sex(odd=M,even=F) + check = 11 digits',
    validity: 10,
    fonts: ['OCR-B 10 BT', 'Perfo_Austria', 'ocrb10', 'latha'],
    note: 'Months for women offset by 20 in some PESEL variants. Series: A–Z prefix blocks.',
  },
  ESP: {
    docNumFormat: 'P + region(2L) + 6D + P (e.g. PAA123456)',
    docNumPrefixOptions: ['PA','PB','PC','PD','PE','PF','PG','PH','PI','PJ','PK','PL','PM','PN'],
    persNumFormat: 'DNI/NIE: 8D + letter check (DNI) or X/Y/Z + 7D + letter (NIE)',
    validity: 10,
    fonts: ['OCR-B_10_PITCH_BT', 'OCRB10PITCHBT REGULAR', 'Perfo_Spain'],
    note: 'Passport number: 9 chars. Starts and ends with P. Region code in positions 2-3.',
  },
  ITA: {
    docNumFormat: '2L + 7D (e.g. YA1234567)',
    persNumFormat: 'Codice Fiscale: 16 chars — surname(3L) + name(3L) + YY + month(L) + DD + town(4) + check(L)',
    validity: 10,
    fonts: ['OCRB10PitchBT-Regular', 'OCR-B 10 BT', 'ARIALN', 'Perfo_Germany'],
    note: 'Codice Fiscale day for women = day + 40. Month encoded: A=Jan B=Feb C=Mar D=Apr E=May H=Jun L=Jul M=Aug P=Sep R=Oct S=Nov T=Dec',
  },
  ROU: {
    docNumFormat: '8 digits with leading zero (e.g. 01234567)',
    docNumPrefix: '0',
    persNumFormat: 'CNP: S(1) + YY + MM + DD + JJ(county 01-52, Buc=40-46) + NNN + C = 13 digits',
    validity: 5,
    fonts: ['OCR-B 10 BT', 'PERFO_GERMANY'],
    note: 'CNP S values: 1=M 1900s, 2=F 1900s, 3=M 1800s, 4=F 1800s, 5=M 2000s, 6=F 2000s',
  },
  AUS: {
    docNumFormat: 'PA + 7D (e.g. PA1234567)',
    docNumPrefix: 'PA',
    persNumFormat: 'TFN: 9 digits with weighted check digit (weights 1,4,3,7,5,8,6,9,10)',
    validity: 10,
    fonts: ['16063', 'OCR-B 10 BT', 'Perforation New'],
    note: 'All Australian passports since 2014 use PA prefix. Check digit algorithm: sum of digits × weights, result mod 11.',
  },
  IRL: {
    docNumFormat: 'PA + 7D (e.g. PA1234567)',
    docNumPrefix: 'PA',
    persNumFormat: 'PPS: 7D + suffix (A=general, W=women in some contexts)',
    validity: 10,
    fonts: ['MyriadPro-Bold', 'Perfo_Austria', 'Meiryo UI W53'],
    note: 'Irish passport: prefix PA since 2013. PPS number issued by Dept of Social Protection.',
  },
  SWE: {
    docNumFormat: 'Year digit + 7D (e.g. 51234567)',
    persNumFormat: 'Personnummer: YYMMDD-NNNC (N=seq, C=Luhn check). Women: even last digit of NNN.',
    validity: 10,
    fonts: ['OCR-B 10 BT', 'OCRBLetterpressMOT-Regular', 'Perfo_Austria', 'Perfo_Sweden_Micro'],
    note: 'First digit of passport number = last digit of issue year. Full format: YYYYMMDD-XXXXXX on data page.',
  },
  CZE: {
    docNumFormat: '2L + 6D (e.g. AB123456)',
    persNumFormat: 'Rodné číslo: YYMMDD/SSSC (women: MM+50, born 2004+: 4-digit seq)',
    validity: 10,
    fonts: ['Optima nova LT Condensed', 'OptimaNovaLTProRegular', 'Perfo_Czech'],
    note: 'Czech passport number: 8 characters total. Letters from series AA to ZZ.',
  },
  BGR: {
    docNumFormat: '38 + 7D (e.g. 381234567)',
    docNumPrefix: '38',
    persNumFormat: 'EGN: YYMMDD + 3D(region/seq) + check. Women: MM+40.',
    validity: 5,
    fonts: ['HelveticaCE-NarrowBold', 'OCR-B 10 BT', 'Perfo_Bulgaria', 'Signerica_Fat'],
    note: 'All Bulgarian passports have 38 prefix. EGN is the national identity number.',
  },
  HUN: {
    docNumFormat: 'BA + 7D (e.g. BA1234567)',
    docNumPrefix: 'BA',
    persNumFormat: 'TAJ (social security): 9 digits',
    validity: 10,
    fonts: ['Arial MT Std Extra Bold', 'OCRBPro', 'OCR-B 10 BT', 'Perfo_Hungary', 'Perfo_Hungary_NEW'],
    note: 'Hungarian passport series always starts BA. Older series used AA, AB.',
  },
  FIN: {
    docNumFormat: 'FP + 7D (e.g. FP1234567)',
    docNumPrefix: 'FP',
    persNumFormat: 'Henkilötunnus: DDMMYY + century(+/-/A) + NNN + check. E.g. 131052-308T',
    validity: 5,
    fonts: ['OCR-B 10 BT', 'MyriadPro-Regular', 'Perfo_Austria'],
    note: 'FP prefix since 2017. Century marker: + = 1800s, - = 1900s, A = 2000s. Check char from table 0-9A-Y (excl B,G,I,O,Q).',
  },
  LVA: {
    docNumFormat: 'LV + 7D (e.g. LV1234567)',
    docNumPrefix: 'LV',
    persNumFormat: 'Personas kods: DDMMYY-CNNNZ (C=0 1800s/1=1900s/2=2000s)',
    validity: 10,
    fonts: ['Perfo_Latvia', 'OCRBLetterpressMOT-Regular', '18799'],
    note: 'LV prefix on all Latvian passports since 2015.',
  },
  CHE: {
    docNumFormat: 'A + 7D (e.g. A1234567)',
    docNumPrefix: 'A',
    persNumFormat: 'AHV-Nummer: 756.XXXX.XXXX.XC (13 digits with check)',
    validity: 10,
    fonts: ['Frutiger LT 47 Light Condensed', 'FrutigerLTStd-Bold', 'FontBig', 'FontMiddle', 'FontSmall'],
    note: 'Swiss passport: A prefix + 7 digits. Unique font system: 3 sizes (Big/Middle/Small).',
  },
  BEL: {
    docNumFormat: 'EH + 6D (e.g. EH123456)',
    docNumPrefix: 'EH',
    persNumFormat: 'NISS/INSZ: YYMMDD + 3D(seq) + 2D(check) = 11 digits',
    validity: 10,
    fonts: ['trebuc', 'OCR-B 10 BT', 'Perfo_Belgium', 'BelgiumPass Regular'],
    note: 'Belgian passport prefix EH. Unique font: BelgiumPass Regular for document text.',
  },
  EST: {
    docNumFormat: 'Series(KD/KE/KC) or YY + 7D (e.g. KD1234567)',
    docNumPrefixOptions: ['KD','KE','KC'],
    persNumFormat: 'Isikukood: GYYMMDDSSSC (G=1-6 century+sex, SSS=seq, C=check)',
    validity: 10,
    fonts: ['Codystar-Light', 'Codystar-Regular', 'OCR-B 10 BT', 'Perfo_Estonia'],
    note: 'Unique font: Codystar. Series KD most common. G: 1=M 1900s, 2=F 1900s, 3=M 2000s, 4=F 2000s.',
  },
  AUT: {
    docNumFormat: '1L + 8D (e.g. P12345678)',
    persNumFormat: 'Sozialversicherungsnummer: 3D(seq) + DDMMYY + 1D(check) = 10 digits',
    validity: 10,
    fonts: ['OCR-B 10 BT', 'Perfo_Austria'],
    note: 'Austrian passport number: letter + 8 digits. Standard ICAO format.',
  },
  NOR: {
    docNumFormat: '2L + 7D (e.g. AB1234567)',
    persNumFormat: 'Personnummer: DDMMYY + 3D(individual) + 2D(check) = 11 digits',
    validity: 10,
    fonts: ['OCR-B 10 BT', 'Perfo_Austria'],
    note: 'Norwegian passport format follows Nordic standard.',
  },
  GRC: {
    docNumFormat: '2L + 7D (e.g. AB1234567)',
    persNumFormat: 'AMKA: DDMMYY + 5D = 11 digits',
    validity: 5,
    fonts: ['tahoma', 'tahomabd', 'ArialNova', 'OCR-B 10 BT', 'Perfo_Grec-Normal'],
    note: 'Greek passport validity 5 years. Tahoma used for Greek characters.',
  },
  LTU: {
    docNumFormat: '3L + 6D (e.g. ABC123456)',
    persNumFormat: 'Asmens kodas: GYYMMDDSSSC (same structure as Estonian isikukood)',
    validity: 10,
    fonts: ['OCR-B 10 BT', 'Perfo_Bulgaria'],
    note: 'Lithuanian personal code: G=3(M 1900s)/4(F 1900s)/5(M 2000s)/6(F 2000s).',
  },
  DNK: {
    docNumFormat: '9D (e.g. 123456789)',
    persNumFormat: 'CPR: DDMMYY + 4D = 10 digits',
    validity: 10,
    fonts: ['OCR-B 10 BT'],
    note: 'Danish CPR last 4 digits: first indicates century (0-3=1900s, 4-9=various). Even last=F, odd=M.',
  },
  SVK: {
    docNumFormat: '2L + 7D (e.g. AB1234567)',
    persNumFormat: 'Rodné číslo: YYMMDD/SSSC (women: MM+50)',
    validity: 10,
    fonts: ['OCR-B 10 BT'],
    note: 'Same personal number format as Czech Republic.',
  },
  SVN: {
    docNumFormat: '2L + 7D (e.g. AB1234567)',
    persNumFormat: 'EMŠO: DDMMYYY(3-digit year) + 2D(area) + 3D(seq) + 1D(check) = 13 digits',
    validity: 10,
    fonts: ['OCR-B 10 BT', 'Perfo_Austria'],
    note: 'Slovenian EMŠO uses 3-digit year (middle digit of 4-digit year).',
  },
  HRV: {
    docNumFormat: '2L + 7D (e.g. AB1234567)',
    persNumFormat: 'OIB: 11 digits with ISO 7064 check',
    validity: 10,
    fonts: ['OCR-B 10 BT'],
    note: 'Croatian OIB used since 2009. Required on all official documents.',
  },
  GBR: {
    docNumFormat: '9D (e.g. 123456789)',
    persNumFormat: 'NINo: 2L + 6D + suffix (A/B/C/D)',
    validity: 10,
    fonts: ['OCR-B 10 BT'],
    note: 'UK passport number is purely numeric. NINo not printed on passport.',
  },
  USA: {
    docNumFormat: '1L + 8D (e.g. A12345678)',
    persNumFormat: 'ICN (Alien): 9D + < + 4D + check. SSN not on passport.',
    validity: 10,
    fonts: ['OCR-B 10 BT'],
    note: 'US passport: letter A-Z + 8 digits. ICN only in PERSONAL_NUMBER field for non-citizens.',
  },
  CAN: {
    docNumFormat: '2L + 7D (e.g. AB1234567)',
    persNumFormat: 'SIN: 9 digits. First digit 1-7.',
    validity: 10,
    fonts: ['OCR-B 10 BT'],
    note: 'Canadian passport: 2 uppercase letters + 7 digits.',
  },
  BRA: {
    docNumFormat: '2L + 7D (e.g. AA1234567)',
    persNumFormat: 'CPF: 9D + 2 check digits = 11 digits',
    validity: 10,
    fonts: ['OCR-B 10 BT'],
    note: 'Brazilian CPF: check digits calculated via modulo 11.',
  },
  PRT: {
    docNumFormat: '2L + 7D (e.g. AB1234567)',
    persNumFormat: 'NIF: 9 digits, first digit 1-3',
    validity: 5,
    fonts: ['OCR-B 10 BT'],
    note: 'Portuguese passport validity 5 years (adults). NIF first digit: 1/2=individuals, 3=foreigners.',
  },
  NZL: {
    docNumFormat: '1L + 8D (e.g. A12345678)',
    validity: 10,
    fonts: ['OCR-B 10 BT'],
    note: 'New Zealand passport format similar to Australian.',
  },
};

const COUNTRIES: Country[] = [
  { code: 'AFG', name: 'Afghanistan' }, { code: 'ALB', name: 'Albania' },
  { code: 'DZA', name: 'Algeria' }, { code: 'AND', name: 'Andorra' },
  { code: 'AGO', name: 'Angola' }, { code: 'ARG', name: 'Argentina' },
  { code: 'AUS', name: 'Australia' },
  { code: 'AUT', name: 'Austria' },
  { code: 'BHS', name: 'Bahamas' }, { code: 'BHR', name: 'Bahrain' },
  { code: 'BGD', name: 'Bangladesh' },
  { code: 'BEL', name: 'Belgium' }, { code: 'BLZ', name: 'Belize' },
  { code: 'BEN', name: 'Benin' }, { code: 'BTN', name: 'Bhutan' },
  { code: 'BOL', name: 'Bolivia' }, { code: 'BIH', name: 'Bosnia & Herz.' },
  { code: 'BWA', name: 'Botswana' }, { code: 'BRA', name: 'Brazil' },
  { code: 'BRN', name: 'Brunei' }, { code: 'BGR', name: 'Bulgaria' },
  { code: 'BFA', name: 'Burkina Faso' }, { code: 'BDI', name: 'Burundi' },
  { code: 'CPV', name: 'Cabo Verde' }, { code: 'KHM', name: 'Cambodia' },
  { code: 'CMR', name: 'Cameroon' }, { code: 'CAN', name: 'Canada' },
  { code: 'CAF', name: 'C. African Rep.' }, { code: 'TCD', name: 'Chad' },
  { code: 'CHL', name: 'Chile' }, { code: 'CHN', name: 'China' },
  { code: 'COL', name: 'Colombia' }, { code: 'COM', name: 'Comoros' },
  { code: 'COD', name: 'Congo DR' }, { code: 'COG', name: 'Congo Rep.' },
  { code: 'CRI', name: 'Costa Rica' }, { code: 'CIV', name: "Côte d'Ivoire" },
  { code: 'HRV', name: 'Croatia' }, { code: 'CUB', name: 'Cuba' },
  { code: 'CYP', name: 'Cyprus' }, { code: 'CZE', name: 'Czech Republic' },
  { code: 'DNK', name: 'Denmark' }, { code: 'DJI', name: 'Djibouti' },
  { code: 'DOM', name: 'Dominican Rep.' }, { code: 'ECU', name: 'Ecuador' },
  { code: 'EGY', name: 'Egypt' }, { code: 'SLV', name: 'El Salvador' },
  { code: 'GNQ', name: 'Equatorial Guinea' }, { code: 'ERI', name: 'Eritrea' },
  { code: 'EST', name: 'Estonia' }, { code: 'SWZ', name: 'Eswatini' },
  { code: 'ETH', name: 'Ethiopia' }, { code: 'FJI', name: 'Fiji' },
  { code: 'FIN', name: 'Finland' }, { code: 'FRA', name: 'France' },
  { code: 'GAB', name: 'Gabon' }, { code: 'GMB', name: 'Gambia' },
  { code: 'DEU', name: 'Germany' },
  { code: 'GHA', name: 'Ghana' }, { code: 'GRC', name: 'Greece' },
  { code: 'GTM', name: 'Guatemala' }, { code: 'GIN', name: 'Guinea' },
  { code: 'GNB', name: 'Guinea-Bissau' }, { code: 'GUY', name: 'Guyana' },
  { code: 'HTI', name: 'Haiti' }, { code: 'HND', name: 'Honduras' },
  { code: 'HUN', name: 'Hungary' }, { code: 'ISL', name: 'Iceland' },
  { code: 'IND', name: 'India' }, { code: 'IDN', name: 'Indonesia' },
  { code: 'IRN', name: 'Iran' }, { code: 'IRQ', name: 'Iraq' },
  { code: 'IRL', name: 'Ireland' }, { code: 'ISR', name: 'Israel' },
  { code: 'ITA', name: 'Italy' }, { code: 'JAM', name: 'Jamaica' },
  { code: 'JPN', name: 'Japan' }, { code: 'JOR', name: 'Jordan' },
  { code: 'KEN', name: 'Kenya' },
  { code: 'PRK', name: 'Korea (North)' }, { code: 'KOR', name: 'Korea (South)' },
  { code: 'XKX', name: 'Kosovo' }, { code: 'KWT', name: 'Kuwait' },
  { code: 'LAO', name: 'Laos' },
  { code: 'LVA', name: 'Latvia' }, { code: 'LBN', name: 'Lebanon' },
  { code: 'LSO', name: 'Lesotho' }, { code: 'LBR', name: 'Liberia' },
  { code: 'LBY', name: 'Libya' }, { code: 'LIE', name: 'Liechtenstein' },
  { code: 'LTU', name: 'Lithuania' }, { code: 'LUX', name: 'Luxembourg' },
  { code: 'MDG', name: 'Madagascar' }, { code: 'MWI', name: 'Malawi' },
  { code: 'MYS', name: 'Malaysia' }, { code: 'MDV', name: 'Maldives' },
  { code: 'MLI', name: 'Mali' }, { code: 'MLT', name: 'Malta' },
  { code: 'MRT', name: 'Mauritania' }, { code: 'MUS', name: 'Mauritius' },
  { code: 'MEX', name: 'Mexico' },
  { code: 'MCO', name: 'Monaco' }, { code: 'MNG', name: 'Mongolia' },
  { code: 'MNE', name: 'Montenegro' }, { code: 'MAR', name: 'Morocco' },
  { code: 'MOZ', name: 'Mozambique' }, { code: 'MMR', name: 'Myanmar' },
  { code: 'NAM', name: 'Namibia' }, { code: 'NPL', name: 'Nepal' },
  { code: 'NLD', name: 'Netherlands' }, { code: 'NZL', name: 'New Zealand' },
  { code: 'NIC', name: 'Nicaragua' }, { code: 'NER', name: 'Niger' },
  { code: 'NGA', name: 'Nigeria' }, { code: 'MKD', name: 'North Macedonia' },
  { code: 'NOR', name: 'Norway' }, { code: 'OMN', name: 'Oman' },
  { code: 'PAK', name: 'Pakistan' }, { code: 'PAN', name: 'Panama' },
  { code: 'PNG', name: 'Papua New Guinea' }, { code: 'PRY', name: 'Paraguay' },
  { code: 'PER', name: 'Peru' }, { code: 'PHL', name: 'Philippines' },
  { code: 'POL', name: 'Poland' }, { code: 'PRT', name: 'Portugal' },
  { code: 'QAT', name: 'Qatar' }, { code: 'ROU', name: 'Romania' },
  { code: 'RWA', name: 'Rwanda' },
  { code: 'SAU', name: 'Saudi Arabia' }, { code: 'SEN', name: 'Senegal' },
  { code: 'SRB', name: 'Serbia' }, { code: 'SLE', name: 'Sierra Leone' },
  { code: 'SGP', name: 'Singapore' }, { code: 'SVK', name: 'Slovakia' },
  { code: 'SVN', name: 'Slovenia' }, { code: 'SOM', name: 'Somalia' },
  { code: 'ZAF', name: 'South Africa' }, { code: 'SSD', name: 'South Sudan' },
  { code: 'ESP', name: 'Spain' }, { code: 'LKA', name: 'Sri Lanka' },
  { code: 'SDN', name: 'Sudan' }, { code: 'SUR', name: 'Suriname' },
  { code: 'SWE', name: 'Sweden' }, { code: 'CHE', name: 'Switzerland' },
  { code: 'SYR', name: 'Syria' }, { code: 'TWN', name: 'Taiwan' },
  { code: 'TZA', name: 'Tanzania' },
  { code: 'THA', name: 'Thailand' }, { code: 'TLS', name: 'Timor-Leste' },
  { code: 'TGO', name: 'Togo' }, { code: 'TTO', name: 'Trinidad & Tobago' },
  { code: 'TUN', name: 'Tunisia' }, { code: 'TUR', name: 'Turkey' },
  { code: 'UGA', name: 'Uganda' },
  { code: 'ARE', name: 'UAE' },
  { code: 'GBR', name: 'United Kingdom' }, { code: 'USA', name: 'United States' },
  { code: 'URY', name: 'Uruguay' },
  { code: 'VEN', name: 'Venezuela' }, { code: 'VNM', name: 'Vietnam' },
  { code: 'YEM', name: 'Yemen' }, { code: 'ZMB', name: 'Zambia' },
  { code: 'ZWE', name: 'Zimbabwe' },
].sort((a, b) => a.name.localeCompare(b.name));

const A3_TO_A2: Record<string, string> = {
  AFG:'af',ALB:'al',DZA:'dz',AND:'ad',AGO:'ao',ARG:'ar',AUS:'au',AUT:'at',
  BHS:'bs',BHR:'bh',BGD:'bd',BEL:'be',BLZ:'bz',BEN:'bj',BTN:'bt',BOL:'bo',
  BIH:'ba',BWA:'bw',BRA:'br',BRN:'bn',BGR:'bg',BFA:'bf',BDI:'bi',CPV:'cv',
  KHM:'kh',CMR:'cm',CAN:'ca',CAF:'cf',TCD:'td',CHL:'cl',CHN:'cn',COL:'co',
  COM:'km',COD:'cd',COG:'cg',CRI:'cr',CIV:'ci',HRV:'hr',CUB:'cu',CYP:'cy',
  CZE:'cz',DNK:'dk',DJI:'dj',DOM:'do',ECU:'ec',EGY:'eg',SLV:'sv',GNQ:'gq',
  ERI:'er',EST:'ee',SWZ:'sz',ETH:'et',FJI:'fj',FIN:'fi',FRA:'fr',GAB:'ga',
  GMB:'gm',DEU:'de',GHA:'gh',GRC:'gr',GTM:'gt',GIN:'gn',GNB:'gw',GUY:'gy',
  HTI:'ht',HND:'hn',HUN:'hu',ISL:'is',IND:'in',IDN:'id',IRN:'ir',IRQ:'iq',
  IRL:'ie',ISR:'il',ITA:'it',JAM:'jm',JPN:'jp',JOR:'jo',KEN:'ke',PRK:'kp',
  KOR:'kr',KWT:'kw',LAO:'la',LVA:'lv',LBN:'lb',LSO:'ls',LBR:'lr',
  LBY:'ly',LIE:'li',LTU:'lt',LUX:'lu',MDG:'mg',MWI:'mw',MYS:'my',MDV:'mv',
  MLI:'ml',MLT:'mt',MRT:'mr',MUS:'mu',MEX:'mx',MCO:'mc',MNG:'mn',MNE:'me',
  MAR:'ma',MOZ:'mz',MMR:'mm',NAM:'na',NPL:'np',NLD:'nl',NZL:'nz',NIC:'ni',
  NER:'ne',NGA:'ng',MKD:'mk',NOR:'no',OMN:'om',PAK:'pk',PAN:'pa',PNG:'pg',
  PRY:'py',PER:'pe',PHL:'ph',POL:'pl',PRT:'pt',QAT:'qa',ROU:'ro',RWA:'rw',
  SAU:'sa',SEN:'sn',SRB:'rs',SLE:'sl',SGP:'sg',SVK:'sk',SVN:'si',SOM:'so',
  ZAF:'za',SSD:'ss',ESP:'es',LKA:'lk',SDN:'sd',SUR:'sr',SWE:'se',CHE:'ch',
  SYR:'sy',TWN:'tw',TZA:'tz',THA:'th',TLS:'tl',TGO:'tg',TTO:'tt',TUN:'tn',
  TUR:'tr',UGA:'ug',ARE:'ae',GBR:'gb',USA:'us',URY:'uy',VEN:'ve',VNM:'vn',
  YEM:'ye',ZMB:'zm',ZWE:'zw',XKX:'xk',
};

function flagUrl(code3: string): string {
  const a2 = A3_TO_A2[code3];
  if (!a2) return '';
  return `https://flagcdn.com/16x12/${a2}.png`;
}

interface ForgeFields {
  docType: string;
  nationality: string;
  issuer: string;
  lastname: string;
  firstname: string;
  birthDate: string;
  sex: string;
  docNum: string;
  expiryDate: string;
  subType: string;
  persNum: string;
  optional: string;
}

interface Preset { label: string; docType: string; nat: string; issuer: string; subType?: string; custom?: boolean; }
interface HistoryEntry { result: MrzGenResult; fields: ForgeFields; }

const DEFAULT_PRESETS: Preset[] = [
  { label: 'US Passport', docType: 'Passport', nat: 'USA', issuer: 'USA' },
  { label: 'DE ID Card',  docType: 'ID Card',  nat: 'DEU', issuer: 'DEU', subType: 'D' },
];

@Component({
  selector: 'app-mrz-forge',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="forge">

      <!-- Top bar: presets + steps -->
      <div class="forge-topbar">
        <div class="steps">
          @for (s of [1,2,3]; track s) {
            <div class="step" [class.active]="step() === s" [class.done]="step() > s" (click)="goStep(s)">
              <div class="step-num mono">{{ s }}</div>
              <div class="step-label mono">{{ stepLabel(s) }}</div>
            </div>
            @if (s < 3) { <div class="step-line" [class.done]="step() > s"></div> }
          }
        </div>
        <div class="presets-row">
          <span class="presets-label mono">PRESETS</span>
          @for (p of allPresets(); track p.label) {
            <button type="button" class="preset-btn mono"
              [class.active]="isActivePreset(p)"
              (click)="applyPreset(p)">
              {{ p.label }}
              @if (p.custom) {
                <span class="preset-del" (click)="deletePreset(p.label); $event.stopPropagation()">×</span>
              }
            </button>
          }
          @if (canSavePreset()) {
            <button type="button" class="preset-save mono" (click)="savePreset()">+ SAVE</button>
          }
          @if (fields().docType && fields().nationality && fields().issuer) {
            <button type="button" class="preset-share mono" [class.copied]="linkCopied()" (click)="shareLink()">
              {{ linkCopied() ? '✓ COPIED' : '⎘ SHARE' }}
            </button>
          }
        </div>
      </div>

      <!-- Two-column body -->
      <div class="forge-cols">

        <!-- LEFT: wizard steps -->
        <div class="forge-left">

      <!-- STEP 1: Document type -->
      @if (step() === 1) {
        <div class="step-body fade-in">
          <div class="doc-grid">
            @for (dt of docTypes; track dt.id) {
              <button type="button" class="doc-card" [class.selected]="fields().docType === dt.id" (click)="selectDocType(dt.id)">
                <span class="doc-icon">{{ dt.icon }}</span>
                <span class="mono doc-name">{{ dt.name }}</span>
                <span class="mono doc-fmt">{{ dt.fmt }}</span>
              </button>
            }
          </div>
          <button type="button" class="btn-next mono" [disabled]="!fields().docType" (click)="step.set(2)">
            NEXT → SELECT COUNTRY
          </button>
        </div>
      }

      <!-- STEP 2: Nationality + Issuer -->
      @if (step() === 2) {
        <div class="step-body fade-in">
          <div class="country-grid">
            <div class="country-col">
              <label class="col-label mono">NATIONALITY</label>
              <div class="search-wrap">
                <input class="search-input mono"
                  [ngModel]="natSearch()"
                  (ngModelChange)="natSearch.set($event)"
                  placeholder="Search country..."
                  autocomplete="off">
              </div>
              <div class="country-list">
                @for (c of filteredNat(); track c.code) {
                  <button type="button" class="country-item" [class.selected]="fields().nationality === c.code" (click)="setNat(c.code)">
                    @if (flagUrl(c.code)) { <img class="item-flag" [src]="flagUrl(c.code)" [alt]="c.code" loading="lazy"> }
                    @else { <span class="item-flag-ph"></span> }
                    <span class="mono item-code">{{ c.code }}</span>
                    <span class="mono item-name">{{ c.name }}</span>
                    @if (countryHasManual(c.code)) { <span class="item-manual-dot" title="Manual data available"></span> }
                  </button>
                }
              </div>
            </div>
            <div class="country-col">
              <label class="col-label mono">ISSUING COUNTRY</label>
              <div class="search-wrap">
                <input class="search-input mono"
                  [ngModel]="issuerSearch()"
                  (ngModelChange)="issuerSearch.set($event)"
                  placeholder="Search country..."
                  autocomplete="off">
              </div>
              <div class="country-list">
                @for (c of filteredIssuer(); track c.code) {
                  <button type="button" class="country-item" [class.selected]="fields().issuer === c.code" (click)="setIssuer(c.code)">
                    @if (flagUrl(c.code)) { <img class="item-flag" [src]="flagUrl(c.code)" [alt]="c.code" loading="lazy"> }
                    @else { <span class="item-flag-ph"></span> }
                    <span class="mono item-code">{{ c.code }}</span>
                    <span class="mono item-name">{{ c.name }}</span>
                    @if (countryHasManual(c.code)) { <span class="item-manual-dot" title="Manual data available"></span> }
                  </button>
                }
              </div>
            </div>
          </div>
          <div class="step-actions">
            <button type="button" class="btn-back mono" (click)="step.set(1)">← BACK</button>
            <button type="button" class="btn-next mono" [disabled]="!fields().nationality || !fields().issuer" (click)="step.set(3)">
              NEXT → FILL DATA
            </button>
          </div>
        </div>
      }

      <!-- STEP 3: Data fields -->
      @if (step() === 3) {
        <div class="step-body fade-in">
          <div class="sel-row">
            <div class="sel-chip mono" (click)="step.set(2)">
              @if (flagUrl(fields().nationality)) { <img class="chip-flag" [src]="flagUrl(fields().nationality)" [alt]="fields().nationality"> }
              <span class="chip-lbl">NAT</span>{{ fields().nationality }}
            </div>
            <div class="sel-chip mono" (click)="step.set(2)">
              @if (flagUrl(fields().issuer)) { <img class="chip-flag" [src]="flagUrl(fields().issuer)" [alt]="fields().issuer"> }
              <span class="chip-lbl">ISS</span>{{ fields().issuer }}
            </div>
            <div class="sel-chip mono" (click)="step.set(1)">
              <span class="chip-lbl">DOC</span>{{ fields().docType }}
            </div>
            @if (hasManual()) {
              <button type="button" class="chip-manual-btn mono" (click)="manualTab.set('info'); showManualOverlay.set(true)">📋 INFO</button>
              <button type="button" class="chip-manual-btn mono fonts" (click)="manualTab.set('fonts'); showManualOverlay.set(true)">🔤 FONTS</button>
            }
          </div>

          <!-- Manual overlay -->
          @if (showManualOverlay() && countryManual(); as m) {
            <div class="manual-overlay">
              <div class="manual-header">
                <div class="manual-tabs">
                  <button type="button" class="mtab mono" [class.active]="manualTab() === 'info'" (click)="manualTab.set('info')">📋 INFO</button>
                  <button type="button" class="mtab mono" [class.active]="manualTab() === 'fonts'" (click)="manualTab.set('fonts')">🔤 FONTS</button>
                </div>
                <button type="button" class="manual-close mono" (click)="showManualOverlay.set(false)">✕</button>
              </div>

              @if (manualTab() === 'info') {
                <div class="manual-body fade-in">
                  <div class="minfo-row">
                    <span class="minfo-key mono">DOC_NUM_FORMAT</span>
                    <span class="minfo-val mono">{{ m.docNumFormat }}</span>
                  </div>
                  @if (m.persNumFormat) {
                    <div class="minfo-row">
                      <span class="minfo-key mono">PERS_NUM_FORMAT</span>
                      <span class="minfo-val mono">{{ m.persNumFormat }}</span>
                    </div>
                  }
                  <div class="minfo-row">
                    <span class="minfo-key mono">VALIDITY</span>
                    <span class="minfo-val mono">{{ m.validity }} years</span>
                  </div>
                  @if (m.note) {
                    <div class="minfo-note mono">{{ m.note }}</div>
                  }
                </div>
              }

              @if (manualTab() === 'fonts') {
                <div class="manual-body fade-in">
                  <div class="fonts-list">
                    @for (f of m.fonts; track f) {
                      <div class="font-item mono">
                        <span class="font-dot"></span>
                        {{ f }}
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <div class="data-actions">
            <button type="button" class="btn-rnd mono" (click)="randomize()">⚡ RANDOM</button>
            <button type="button" class="btn-clr mono" (click)="clearFields()">✕ CLEAR</button>
          </div>

          @if (subTypeWarning()) {
            <div class="subtype-warn mono">⚠ {{ subTypeWarning() }}</div>
          }

          <div class="field-grid">
            <div class="fg-field">
              <label class="mono fg-label">LAST_NAME</label>
              <input class="mono fg-input"
                [ngModel]="fields().lastname"
                (ngModelChange)="patchName('lastname', $event)"
                (blur)="trigger()"
                placeholder="SMITH" autocomplete="off" spellcheck="false">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">FIRST_NAME</label>
              <input class="mono fg-input"
                [ngModel]="fields().firstname"
                (ngModelChange)="patchName('firstname', $event)"
                (blur)="trigger()"
                placeholder="JOHN" autocomplete="off" spellcheck="false">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">
                BIRTH_DATE
                @if (dateError() === 'birth') { <span class="date-err-lbl">future date!</span> }
                @if (dateError() === 'order') { <span class="date-err-lbl">birth > expiry!</span> }
              </label>
              <input class="mono fg-input" [class.input-error]="dateError() === 'birth' || dateError() === 'order'"
                [ngModel]="fields().birthDate"
                (ngModelChange)="patchDate('birthDate', $event)"
                (blur)="trigger()"
                placeholder="DD-MM-YYYY" autocomplete="off">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">SEX</label>
              <div class="sex-group">
                @for (s of ['M','F','U']; track s) {
                  <button type="button" class="sex-btn mono" [class.active]="fields().sex === s" (click)="patch('sex', s); trigger()">
                    {{ s === 'U' && isNeutralSex() ? '<' : s }}
                  </button>
                }
              </div>
            </div>
            <div class="fg-field">
              <label class="mono fg-label">
                DOCUMENT_NUM
                @if (canGenDocNum()) {
                  <button type="button" class="btn-icn-gen mono" (click)="genDocNum()">⚡ GEN</button>
                }
              </label>
              <input class="mono fg-input"
                [ngModel]="fields().docNum"
                (ngModelChange)="patch('docNum', $event)"
                (blur)="trigger()"
                [placeholder]="docNumPlaceholder()" autocomplete="off">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">
                EXPIRY_DATE
                @if (dateError() === 'order') { <span class="date-err-lbl">before birthdate!</span> }
                @if (hasManual()) {
                  <button type="button" class="btn-icn-gen mono expiry-fill" (click)="fillExpiry()">+{{ countryManual()!.validity }}yr</button>
                }
              </label>
              <input class="mono fg-input" [class.input-error]="dateError() === 'order'"
                [ngModel]="fields().expiryDate"
                (ngModelChange)="patchDate('expiryDate', $event)"
                (blur)="trigger()"
                placeholder="DD-MM-YYYY" autocomplete="off">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">SUB_TYPE <span class="opt">opt</span></label>
              <input class="mono fg-input"
                [ngModel]="fields().subType"
                (ngModelChange)="patch('subType', $event)"
                (blur)="trigger()"
                placeholder="e.g. A" maxlength="1" autocomplete="off">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">
                PERSONAL_NUM <span class="opt">opt</span>
                @if (canGenPersNum()) {
                  <button type="button" class="btn-icn-gen mono" (click)="genPersNum()">⚡ {{ persNumLabel() }}</button>
                }
              </label>
              <input class="mono fg-input"
                [ngModel]="fields().persNum"
                (ngModelChange)="patch('persNum', $event)"
                (blur)="trigger()"
                [placeholder]="persNumPlaceholder()" autocomplete="off">
            </div>
            <div class="fg-field fg-full">
              <label class="mono fg-label">OPTIONAL_FIELD <span class="opt">opt</span></label>
              <input class="mono fg-input"
                [ngModel]="fields().optional"
                (ngModelChange)="patch('optional', $event)"
                (blur)="trigger()"
                placeholder="Optional" autocomplete="off">
            </div>
          </div>

          <button type="button" class="btn-gen mono" [disabled]="!canGenerate() || store.loading()" (click)="trigger()">
            <span>›</span> GENERATE MRZ
            @if (store.loading()) { <span class="btn-loader"></span> }
          </button>
          @if (store.mrzGenResult() && hasManual()) {
            <div class="valid-badge mono" [class.valid]="docNumValid()">
              @if (docNumValid()) { ✓ MANUAL_VALID } @else { ⚠ CHECK_DOC_NUM }
            </div>
          }

          <div class="step3-actions">
            <button type="button" class="btn-back mono" (click)="step.set(2)">← BACK</button>
            <button type="button" class="btn-reset mono" (click)="reset()">↺ RESET</button>
          </div>
        </div>
      }

        </div><!-- /forge-left -->

        <!-- RIGHT: output + history -->
        <div class="forge-right">

      <!-- MRZ Output -->
      @if (store.mrzGenResult(); as gen) {
        <div class="forge-output">
          <div class="output-header mono">MRZ_OUTPUT</div>
          @if (gen.MRP) {
            <div class="mrz-format-card">
              <div class="mf-header">
                <span class="mf-tag mono">MRP</span>
                <span class="mf-name mono">PASSPORT · TD3 · 2×44</span>
                <button type="button" class="btn-copy mono" [class.copied]="copiedKey() === 'MRP'" (click)="copy(gen.MRP!.join('\n'), 'MRP')">{{ copiedKey() === 'MRP' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                @for (line of gen.MRP; track $index) {
                  <div class="mrz-line-wrap"><code class="mrz-line mono">{{ line }}</code></div>
                }
              </div>
            </div>
          }
          @if (gen.MRV_A) {
            <div class="mrz-format-card visa">
              <div class="mf-header">
                <span class="mf-tag mono visa">MRV-A</span>
                <span class="mf-name mono">VISA · 2×44</span>
                <button type="button" class="btn-copy visa mono" [class.copied]="copiedKey() === 'MRV_A'" (click)="copy(gen.MRV_A!.join('\n'), 'MRV_A')">{{ copiedKey() === 'MRV_A' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                @for (line of gen.MRV_A; track $index) {
                  <div class="mrz-line-wrap visa"><code class="mrz-line visa mono">{{ line }}</code></div>
                }
              </div>
            </div>
          }
          @if (gen.TD1) {
            <div class="mrz-format-card amber">
              <div class="mf-header">
                <span class="mf-tag mono amber">TD1</span>
                <span class="mf-name mono">ID CARD · 3×30</span>
                <button type="button" class="btn-copy amber mono" [class.copied]="copiedKey() === 'TD1'" (click)="copy(gen.TD1!.join('\n'), 'TD1')">{{ copiedKey() === 'TD1' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                @for (line of gen.TD1; track $index) {
                  <div class="mrz-line-wrap amber"><code class="mrz-line amber mono">{{ line }}</code></div>
                }
              </div>
            </div>
          }
          @if (gen.TD2) {
            <div class="mrz-format-card amber">
              <div class="mf-header">
                <span class="mf-tag mono amber">TD2</span>
                <span class="mf-name mono">ID CARD · 2×36</span>
                <button type="button" class="btn-copy amber mono" [class.copied]="copiedKey() === 'TD2'" (click)="copy(gen.TD2!.join('\n'), 'TD2')">{{ copiedKey() === 'TD2' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                @for (line of gen.TD2; track $index) {
                  <div class="mrz-line-wrap amber"><code class="mrz-line amber mono">{{ line }}</code></div>
                }
              </div>
            </div>
          }
          @if (gen.EDL) {
            <div class="mrz-format-card edl">
              <div class="mf-header">
                <span class="mf-tag mono edl">eDL</span>
                <span class="mf-name mono">DRIVER LICENSE · 1 LINE</span>
                <button type="button" class="btn-copy edl mono" [class.copied]="copiedKey() === 'EDL'" (click)="copy(gen.EDL![0], 'EDL')">{{ copiedKey() === 'EDL' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                <div class="mrz-line-wrap edl"><code class="mrz-line edl mono">{{ gen.EDL[0] }}</code></div>
              </div>
            </div>
          }
        </div>
      }

      <!-- History -->
      @if (genHistory().length > 0) {
        <div class="history-block">
          <div class="history-header mono">// RECENT</div>
          <div class="history-list">
            @for (h of genHistory(); track $index) {
              <button type="button" class="history-item mono" (click)="restoreHistory(h)">
                @if (flagUrl(h.fields.nationality)) { <img class="hi-flag" [src]="flagUrl(h.fields.nationality)" [alt]="h.fields.nationality"> }
                <span class="hi-type">{{ h.result.DOC_TYPE }}</span>
                <span class="hi-lines">
                  {{ h.fields.lastname }}{{ h.fields.firstname ? ' ' + h.fields.firstname : '' }}
                </span>
                <span class="hi-idx">#{{ $index + 1 }}</span>
              </button>
            }
          </div>
        </div>
      }

        </div><!-- /forge-right -->
      </div><!-- /forge-cols -->
    </div>
  `,
  styles: [`
    .forge {
      display: flex; flex-direction: column; gap: 12px;
      height: 100%;
    }
    .forge-topbar {
      display: flex; align-items: center; gap: 20px;
      flex-shrink: 0; flex-wrap: wrap;
    }
    .forge-cols {
      display: flex; gap: 20px;
      flex: 1; min-height: 0;
    }
    .forge-left {
      width: 380px; flex-shrink: 0;
      display: flex; flex-direction: column; gap: 14px;
      overflow-y: auto; padding-right: 4px;
    }
    .forge-right {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 12px;
      overflow-y: auto; padding-left: 4px;
    }

    /* Steps */
    .steps {
      display: flex; align-items: center;
      flex-shrink: 0;
    }
    .step {
      display: flex; align-items: center; gap: 8px;
      cursor: pointer; opacity: 0.4; transition: opacity 0.2s;
    }
    .step.active, .step.done { opacity: 1; }
    .step-num {
      width: 22px; height: 22px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.6rem; font-weight: 800;
      background: var(--border); color: var(--text-dim);
      border: 1px solid var(--border); transition: 0.2s;
      flex-shrink: 0;
    }
    .step.active .step-num { background: var(--green); color: #000; border-color: var(--green); box-shadow: 0 0 10px var(--green-glow); }
    .step.done .step-num { background: var(--green-dim); color: var(--green); border-color: var(--green); }
    .step-label { font-size: 0.5rem; color: var(--text-dim); letter-spacing: 1.5px; }
    .step.active .step-label { color: var(--green); }
    .step-line { flex: 1; height: 1px; background: var(--border); margin: 0 8px; min-width: 24px; transition: 0.2s; }
    .step-line.done { background: var(--green); }

    /* Step body */
    .step-body { display: flex; flex-direction: column; gap: 12px; }

    /* Doc type */
    .doc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .doc-card {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 14px 10px;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: var(--radius-sm); cursor: pointer; transition: 0.15s;
    }
    .doc-card:hover { border-color: var(--border-green); background: rgba(0,255,65,0.03); }
    .doc-card.selected { border-color: var(--green); background: var(--green-dim); box-shadow: 0 0 20px rgba(0,255,65,0.1); }
    .doc-icon { font-size: 1.4rem; }
    .doc-name { font-size: 0.6rem; font-weight: 700; color: var(--text); letter-spacing: 1px; }
    .doc-fmt { font-size: 0.45rem; color: var(--text-dim); letter-spacing: 1px; }
    .doc-card.selected .doc-name { color: var(--green); }

    /* Country selection */
    .country-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .country-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .col-label { font-size: 0.55rem; font-weight: 700; color: var(--text-dim); letter-spacing: 2px; }
    .search-wrap {
      background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 8px 12px;
      transition: border-color 0.15s;
    }
    .search-wrap:focus-within { border-color: var(--border-green); }
    .search-input {
      width: 100%; background: none; border: none; outline: none;
      color: var(--green); font-size: 0.7rem; box-sizing: border-box;
    }
    .search-input::placeholder { color: var(--text-dim); }
    .country-list {
      max-height: 180px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 2px;
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      padding: 4px;
    }
    .country-item {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; border-radius: 6px;
      background: none; border: none; cursor: pointer;
      text-align: left; transition: background 0.1s; width: 100%;
    }
    .country-item:hover { background: rgba(255,255,255,0.04); }
    .country-item.selected { background: var(--green-dim); }
    .item-flag { width: 16px; height: 12px; flex-shrink: 0; object-fit: cover; border-radius: 1px; }
    .item-flag-ph { width: 16px; height: 12px; flex-shrink: 0; }
    .item-code {
      font-size: 0.55rem; font-weight: 800; color: var(--green);
      width: 30px; flex-shrink: 0; letter-spacing: 1px;
    }
    .item-name { font-size: 0.6rem; color: var(--text-mid); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .country-item.selected .item-name { color: var(--text); }

    /* Step actions */
    .step-actions { display: flex; gap: 10px; }
    .btn-next {
      flex: 1; padding: 12px 16px;
      background: var(--green); color: #000;
      border: none; border-radius: var(--radius-sm);
      font-size: 0.65rem; font-weight: 800; letter-spacing: 2px;
      cursor: pointer; transition: 0.15s;
    }
    .btn-next:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-next:disabled { opacity: 0.35; cursor: not-allowed; }
    .btn-back {
      padding: 12px 16px;
      background: none; border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-dim);
      font-size: 0.6rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; align-self: flex-start;
    }
    .btn-back:hover { border-color: var(--border-green); color: var(--text); }

    /* Fields grid */
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .fg-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .fg-full { grid-column: 1 / -1; }
    .fg-label { font-size: 0.48rem; font-weight: 700; color: var(--text-dim); letter-spacing: 1.5px; }
    .opt { font-weight: 400; opacity: 0.6; }
    .fg-input {
      background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 7px 10px;
      color: var(--green); font-size: 0.75rem; font-weight: 700;
      outline: none; transition: border-color 0.15s; width: 100%;
      box-sizing: border-box;
    }
    .fg-input:focus { border-color: var(--border-green); }
    .sex-group { display: flex; gap: 6px; }
    .sex-btn {
      flex: 1; padding: 8px 4px;
      background: none; border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-dim);
      font-size: 0.65rem; font-weight: 800; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s;
    }
    .sex-btn.active { background: var(--green-dim); border-color: var(--green); color: var(--green); }

    /* Generate button */
    .btn-gen {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px 20px;
      background: var(--green); color: #000;
      border: none; border-radius: var(--radius-sm);
      font-size: 0.7rem; font-weight: 800; letter-spacing: 2px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .btn-gen:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-gen:disabled { opacity: 0.35; cursor: not-allowed; }
    .step3-actions {
      display: flex; gap: 8px; margin-top: 4px;
    }
    .btn-reset {
      padding: 12px 16px;
      background: none; border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-dim);
      font-size: 0.6rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s;
    }
    .btn-reset:hover { border-color: #ff4444; color: #ff4444; }
    .btn-loader {
      width: 12px; height: 12px;
      border: 2px solid rgba(0,0,0,0.3);
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Selected chips */
    .sel-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .sel-chip {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 10px;
      background: var(--green-dim); border: 1px solid var(--border-green);
      border-radius: 20px; font-size: 0.55rem; font-weight: 700;
      color: var(--green); cursor: pointer; letter-spacing: 1px;
      transition: 0.15s;
    }
    .sel-chip:hover { filter: brightness(1.2); }
    .chip-flag { width: 16px; height: 12px; object-fit: cover; border-radius: 1px; flex-shrink: 0; }
    .chip-lbl { color: var(--text-dim); font-size: 0.45rem; margin-right: 4px; }

    /* MRZ output */
    .forge-output { display: flex; flex-direction: column; gap: 12px; }
    .output-header {
      font-size: 0.5rem; font-weight: 700; color: var(--text-dim);
      letter-spacing: 3px; padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }
    .mrz-format-card {
      background: rgba(0,0,0,0.6);
      border: 1px solid var(--border-green);
      border-radius: var(--radius-sm);
      padding: 14px 16px;
      display: flex; flex-direction: column; gap: 10px;
      box-shadow: 0 0 20px rgba(0,255,65,0.04), inset 0 1px 0 rgba(0,255,65,0.06);
    }
    .mrz-format-card.amber { border-color: rgba(255,149,0,0.35); box-shadow: 0 0 20px rgba(255,149,0,0.04), inset 0 1px 0 rgba(255,149,0,0.06); }
    .mrz-format-card.visa  { border-color: rgba(0,122,255,0.35); box-shadow: 0 0 20px rgba(0,122,255,0.04), inset 0 1px 0 rgba(0,122,255,0.06); }
    .mrz-format-card.edl   { border-color: rgba(168,85,247,0.35); box-shadow: 0 0 20px rgba(168,85,247,0.04), inset 0 1px 0 rgba(168,85,247,0.06); }
    .mf-header { display: flex; align-items: center; gap: 10px; }
    .mf-tag {
      font-size: 0.5rem; font-weight: 800; letter-spacing: 1.5px;
      padding: 3px 8px; border-radius: 4px; flex-shrink: 0;
      background: var(--green-dim); color: var(--green); border: 1px solid var(--border-green);
    }
    .mf-tag.amber { background: rgba(255,149,0,0.12); color: #ff9500; border-color: rgba(255,149,0,0.4); }
    .mf-tag.visa  { background: rgba(0,122,255,0.12); color: #007aff; border-color: rgba(0,122,255,0.4); }
    .mf-tag.edl   { background: rgba(168,85,247,0.12); color: #a855f7; border-color: rgba(168,85,247,0.4); }
    .mf-name { font-size: 0.5rem; color: var(--text-dim); letter-spacing: 1.5px; flex: 1; }
    .mrz-block { display: flex; flex-direction: column; gap: 4px; }
    .mrz-line-wrap {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(0,255,65,0.08);
      border-radius: 4px; padding: 10px 14px; overflow-x: auto;
      position: relative;
    }
    .mrz-line-wrap::before {
      content: '';
      position: absolute; inset: 0;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.015) 2px, rgba(0,255,65,0.015) 4px);
      pointer-events: none; border-radius: 4px;
    }
    .mrz-line-wrap.amber { border-color: rgba(255,149,0,0.1); }
    .mrz-line-wrap.amber::before { background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,149,0,0.015) 2px, rgba(255,149,0,0.015) 4px); }
    .mrz-line-wrap.visa  { border-color: rgba(0,122,255,0.1); }
    .mrz-line-wrap.visa::before  { background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,122,255,0.015) 2px, rgba(0,122,255,0.015) 4px); }
    .mrz-line-wrap.edl   { border-color: rgba(168,85,247,0.1); }
    .mrz-line-wrap.edl::before   { background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(168,85,247,0.015) 2px, rgba(168,85,247,0.015) 4px); }
    .mrz-line {
      font-size: 0.75rem; letter-spacing: 3px; color: var(--green);
      white-space: nowrap; display: block; font-weight: 700;
      text-shadow: 0 0 8px rgba(0,255,65,0.5);
    }
    .mrz-line.amber { color: #ff9500; text-shadow: 0 0 8px rgba(255,149,0,0.4); }
    .mrz-line.visa  { color: #007aff; text-shadow: 0 0 8px rgba(0,122,255,0.4); }
    .mrz-line.edl   { color: #a855f7; text-shadow: 0 0 8px rgba(168,85,247,0.4); }
    .btn-copy {
      background: var(--green-dim); border: 1px solid var(--border-green);
      color: var(--green); font-size: 0.5rem; font-weight: 700;
      padding: 4px 10px; border-radius: 4px; cursor: pointer; letter-spacing: 1px;
      white-space: nowrap; flex-shrink: 0; font-family: inherit;
      transition: 0.15s; min-width: 48px; text-align: center;
    }
    .btn-copy.copied { background: var(--green); color: #000; border-color: var(--green); }
    .btn-copy.amber { background: rgba(255,149,0,0.1); border-color: rgba(255,149,0,0.3); color: #ff9500; }
    .btn-copy.amber.copied { background: #ff9500; color: #000; }
    .btn-copy.visa  { background: rgba(0,122,255,0.1); border-color: rgba(0,122,255,0.3); color: #007aff; }
    .btn-copy.visa.copied  { background: #007aff; color: #fff; }
    .btn-copy.edl   { background: rgba(168,85,247,0.1); border-color: rgba(168,85,247,0.3); color: #a855f7; }
    .btn-copy.edl.copied   { background: #a855f7; color: #fff; }

    /* Presets */
    .presets-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 10px 14px;
      background: rgba(0,0,0,0.3); border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .presets-label {
      font-size: 0.45rem; font-weight: 700; color: var(--text-dim);
      letter-spacing: 2px; flex-shrink: 0; margin-right: 4px;
    }
    .preset-btn {
      display: flex; align-items: center; gap: 5px;
      padding: 4px 10px;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: 20px; color: var(--text-mid);
      font-size: 0.55rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .preset-btn:hover { border-color: var(--border-green); color: var(--text); }
    .preset-btn.active { background: var(--green-dim); border-color: var(--green); color: var(--green); }
    .preset-del {
      font-size: 0.7rem; line-height: 1; color: var(--text-dim);
      margin-left: 2px; opacity: 0.6;
    }
    .preset-del:hover { opacity: 1; color: #ff3b30; }
    .preset-save {
      padding: 4px 10px;
      background: none; border: 1px dashed var(--border-green);
      border-radius: 20px; color: var(--green);
      font-size: 0.55rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; font-family: inherit; opacity: 0.7;
    }
    .preset-save:hover { opacity: 1; background: var(--green-dim); }
    .preset-share {
      padding: 4px 10px; margin-left: auto;
      background: none; border: 1px solid var(--border);
      border-radius: 20px; color: var(--text-dim);
      font-size: 0.55rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .preset-share:hover { border-color: var(--border-green); color: var(--green); }
    .preset-share.copied { background: var(--green-dim); border-color: var(--green); color: var(--green); }

    /* ICN gen button */
    .btn-icn-gen {
      display: inline-flex; align-items: center; gap: 3px;
      margin-left: 8px; padding: 2px 7px;
      background: rgba(255,149,0,0.1); border: 1px solid rgba(255,149,0,0.35);
      border-radius: 4px; color: #ff9500;
      font-size: 0.45rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; font-family: inherit; transition: 0.15s;
      vertical-align: middle;
    }
    .btn-icn-gen:hover { background: rgba(255,149,0,0.2); }

    /* Data action buttons */
    .data-actions { display: flex; gap: 8px; margin-bottom: 4px; }
    .btn-rnd {
      padding: 7px 14px; background: rgba(255,149,0,0.1);
      border: 1px solid rgba(255,149,0,0.35); border-radius: var(--radius-sm);
      color: #ff9500; font-size: 0.55rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s;
    }
    .btn-rnd:hover { background: rgba(255,149,0,0.2); }
    .btn-clr {
      padding: 7px 14px; background: none;
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      color: var(--text-dim); font-size: 0.55rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s;
    }
    .btn-clr:hover { border-color: #ff4444; color: #ff4444; }

    /* SubType warning */
    .subtype-warn {
      padding: 8px 12px; margin-bottom: 4px;
      background: rgba(255,149,0,0.08); border: 1px solid rgba(255,149,0,0.3);
      border-radius: var(--radius-sm); font-size: 0.55rem; color: #ff9500; letter-spacing: 0.5px;
    }

    /* Date validation */
    .date-err-lbl {
      color: #ff4444; font-size: 0.45rem; font-weight: 700;
      margin-left: 6px; letter-spacing: 0.5px;
    }
    .input-error { border-color: rgba(255,68,68,0.6) !important; }

    /* History */
    .history-block { margin-top: 16px; }
    .history-header {
      font-size: 0.5rem; color: var(--text-dim); letter-spacing: 2px;
      margin-bottom: 6px;
    }
    .history-list { display: flex; flex-direction: column; gap: 4px; }
    .history-item {
      display: flex; align-items: center; gap: 10px;
      padding: 7px 12px;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: var(--radius-sm); cursor: pointer;
      transition: border-color 0.15s; text-align: left; width: 100%;
    }
    .history-item:hover { border-color: var(--border-green); }
    .hi-type {
      font-size: 0.5rem; font-weight: 800; color: var(--green);
      background: var(--green-dim); padding: 2px 6px; border-radius: 4px;
      letter-spacing: 1px; flex-shrink: 0;
    }
    .hi-flag { width: 16px; height: 12px; object-fit: cover; border-radius: 1px; flex-shrink: 0; }
    .hi-lines { font-size: 0.55rem; color: var(--text-dim); flex: 1; letter-spacing: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hi-idx { font-size: 0.45rem; color: var(--text-dim); opacity: 0.5; flex-shrink: 0; }

    /* Manual overlay buttons in sel-row */
    .chip-manual-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 5px 10px;
      background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3);
      border-radius: 20px; font-size: 0.5rem; font-weight: 700;
      color: #a855f7; cursor: pointer; letter-spacing: 1px;
      transition: 0.15s; font-family: inherit;
    }
    .chip-manual-btn:hover { background: rgba(168,85,247,0.2); border-color: rgba(168,85,247,0.5); }
    .chip-manual-btn.fonts { background: rgba(0,122,255,0.1); border-color: rgba(0,122,255,0.3); color: #007aff; }
    .chip-manual-btn.fonts:hover { background: rgba(0,122,255,0.2); }

    /* Manual overlay */
    .manual-overlay {
      background: rgba(8,4,16,0.97); border: 1px solid rgba(168,85,247,0.35);
      border-radius: var(--radius-sm); overflow: hidden;
      box-shadow: 0 0 24px rgba(168,85,247,0.12), inset 0 1px 0 rgba(168,85,247,0.1);
    }
    .manual-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(168,85,247,0.15);
      background: rgba(168,85,247,0.05);
    }
    .manual-tabs { display: flex; gap: 6px; }
    .mtab {
      padding: 4px 12px;
      background: none; border: 1px solid rgba(168,85,247,0.25);
      border-radius: 20px; color: rgba(168,85,247,0.6);
      font-size: 0.48rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .mtab.active { background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.6); color: #a855f7; }
    .mtab:hover:not(.active) { border-color: rgba(168,85,247,0.4); color: rgba(168,85,247,0.8); }
    .manual-close {
      padding: 3px 8px; background: none; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 4px; color: var(--text-dim); font-size: 0.6rem;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .manual-close:hover { border-color: #ff4444; color: #ff4444; }
    .manual-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
    .minfo-row {
      display: flex; flex-direction: column; gap: 3px;
      padding: 8px 10px;
      background: rgba(168,85,247,0.05); border: 1px solid rgba(168,85,247,0.1);
      border-radius: 6px;
    }
    .minfo-key { font-size: 0.42rem; font-weight: 700; color: rgba(168,85,247,0.7); letter-spacing: 2px; }
    .minfo-val { font-size: 0.58rem; color: var(--text); letter-spacing: 0.5px; line-height: 1.5; }
    .minfo-note {
      font-size: 0.52rem; color: var(--text-dim); letter-spacing: 0.5px;
      padding: 8px 10px; line-height: 1.6;
      border-left: 2px solid rgba(168,85,247,0.3);
      background: rgba(168,85,247,0.03); border-radius: 0 4px 4px 0;
    }
    .fonts-list { display: flex; flex-direction: column; gap: 6px; }
    .font-item {
      display: flex; align-items: center; gap: 10px;
      font-size: 0.58rem; color: var(--text-mid); letter-spacing: 0.5px;
    }
    .font-dot {
      width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
      background: #007aff; box-shadow: 0 0 6px rgba(0,122,255,0.5);
    }

    /* Completeness dot in country list */
    .item-manual-dot {
      width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; margin-left: auto;
      background: var(--green); box-shadow: 0 0 4px var(--green-glow);
    }

    /* Validation badge */
    .valid-badge {
      display: flex; align-items: center; justify-content: center;
      padding: 6px 12px; border-radius: var(--radius-sm);
      font-size: 0.5rem; font-weight: 800; letter-spacing: 2px;
      background: rgba(255,149,0,0.08); border: 1px solid rgba(255,149,0,0.3); color: #ff9500;
      transition: 0.3s;
    }
    .valid-badge.valid {
      background: rgba(0,255,65,0.08); border-color: rgba(0,255,65,0.3); color: var(--green);
      box-shadow: 0 0 10px rgba(0,255,65,0.06);
    }

    /* Expiry autofill button */
    .btn-icn-gen.expiry-fill {
      background: rgba(0,122,255,0.1); border-color: rgba(0,122,255,0.35); color: #007aff;
    }
    .btn-icn-gen.expiry-fill:hover { background: rgba(0,122,255,0.2); }

    @media (max-width: 900px) {
      .forge-cols { flex-direction: column; }
      .forge-left { width: 100%; overflow-y: visible; }
      .forge-right { min-height: 200px; }
      .forge-topbar { flex-direction: column; align-items: flex-start; gap: 10px; }
    }
    @media (max-width: 767px) {
      .doc-grid { grid-template-columns: 1fr 1fr; }
      .country-grid { grid-template-columns: 1fr; }
      .field-grid { grid-template-columns: 1fr; }
      .fg-full { grid-column: 1; }
    }
  `]
})
export class MrzForgeComponent implements OnInit, OnDestroy {
  store = inject(AppStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  step = signal(1);
  natSearch = signal('');
  issuerSearch = signal('');
  copiedKey = signal<string | null>(null);
  genHistory = signal<HistoryEntry[]>(this.loadHistory());

  subTypeWarning = computed<string | null>(() => {
    const f = this.fields();
    const code = f.nationality || f.issuer;
    const warnings: Record<string, string> = {
      DEU: 'DE: subType D required. Line 1 starts with IDD<<',
      AUT: 'AT: official ID cards use subType A (IDA<<)',
      CHE: 'CH: Swiss ID uses subType C (IDC<<)',
      ITA: 'IT: CIE (Carta d\'Identità Elettronica) — doc type is C, subType I. Line 1: CI<ITA...',
      GBR: 'GB: BRP/BRC cards use subType A or B',
      USA: 'US: Passport Card uses subType C',
      CAN: 'CA: PR card uses subType R',
      FRA: 'FR: Titre de séjour uses subType R or T',
      NLD: 'NL: Verblijfsvergunning uses subType N',
      POL: 'PL: Karta Pobytu uses subType P',
    };
    return warnings[code] ?? null;
  });

  dateError = computed<'birth' | 'order' | null>(() => {
    const f = this.fields();
    const parseDate = (s: string) => {
      const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (!m) return null;
      return new Date(+m[3], +m[2] - 1, +m[1]);
    };
    const birth = parseDate(f.birthDate);
    const expiry = parseDate(f.expiryDate);
    const now = new Date();
    if (birth && birth > now) return 'birth';
    if (birth && expiry && birth >= expiry) return 'order';
    return null;
  });

  fields = signal<ForgeFields>({
    docType: '', nationality: '', issuer: '',
    lastname: '', firstname: '', birthDate: '',
    sex: 'M', docNum: '', expiryDate: '',
    subType: '', persNum: '', optional: '',
  });

  docTypes = [
    { id: 'Passport', icon: '📕', name: 'PASSPORT', fmt: 'MRP · 2×44' },
    { id: 'ID Card',  icon: '🪪', name: 'ID CARD',  fmt: 'TD1 3×30 · TD2 2×36' },
    { id: 'Visa',     icon: '🛂', name: 'VISA',     fmt: 'MRV-A · 2×44' },
  ];

  filteredNat = computed(() => {
    const q = this.natSearch().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  filteredIssuer = computed(() => {
    const q = this.issuerSearch().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    this.initTrigger();
    const p = this.route.snapshot.queryParamMap;
    const doc = p.get('doc');
    const nat = p.get('nat');
    const iss = p.get('iss');
    const sub = p.get('sub');
    if (doc && nat && iss) {
      this.fields.update(f => ({
        ...f,
        docType: doc,
        nationality: nat,
        issuer: iss,
        subType: sub ?? f.subType,
      }));
      this.step.set(3);
    }
  }

  private syncUrl() {
    const f = this.fields();
    const queryParams: Record<string, string> = {};
    if (f.docType)    queryParams['doc'] = f.docType;
    if (f.nationality) queryParams['nat'] = f.nationality;
    if (f.issuer)     queryParams['iss'] = f.issuer;
    if (f.subType)    queryParams['sub'] = f.subType;
    this.router.navigate([], { queryParams, replaceUrl: true });
  }

  canGenerate = computed(() => {
    const f = this.fields();
    return !!(f.docType && f.nationality && f.issuer && f.lastname && f.birthDate && f.docNum && f.expiryDate);
  });

  stepLabel(s: number) {
    return ['DOC_TYPE', 'COUNTRY', 'DATA'][s - 1];
  }

  goStep(s: number) {
    if (s <= this.step()) this.step.set(s);
  }

  selectDocType(id: string) {
    this.fields.update(f => ({ ...f, docType: id }));
    this.store.mrzGenResult.set(null);
    this.syncUrl();
  }

  setNat(code: string) {
    this.fields.update(f => ({ ...f, nationality: code }));
    this.syncUrl();
  }

  setIssuer(code: string) {
    this.fields.update(f => ({ ...f, issuer: code }));
    this.syncUrl();
  }

  // ── Manual info ───────────────────────────────────────────
  showManualOverlay = signal(false);
  manualTab = signal<'info' | 'fonts'>('info');

  countryManual = computed<ManualInfo | null>(() => {
    const f = this.fields();
    const code = f.issuer || f.nationality;
    return MANUAL_DATA[code] ?? null;
  });

  hasManual = computed(() => !!this.countryManual());

  docNumValid = computed<boolean>(() => {
    const f = this.fields();
    if (!f.docNum) return false;
    const code = f.issuer || f.nationality;
    const manual = MANUAL_DATA[code];
    if (!manual) return false;
    if (manual.docNumPrefix && !f.docNum.startsWith(manual.docNumPrefix)) return false;
    if (manual.docNumPrefixOptions) {
      const hasPrefix = manual.docNumPrefixOptions.some(p => f.docNum.startsWith(p));
      if (!hasPrefix) return false;
    }
    return f.docNum.length >= 7 && f.docNum.length <= 9;
  });

  fillExpiry() {
    const f = this.fields();
    const manual = MANUAL_DATA[f.issuer || f.nationality];
    const validity = manual?.validity ?? 10;
    const m = f.birthDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    const base = m ? new Date() : new Date();
    const exp = new Date(base.getFullYear() + validity, base.getMonth(), base.getDate());
    const dd = String(exp.getDate()).padStart(2, '0');
    const mm = String(exp.getMonth() + 1).padStart(2, '0');
    const yyyy = exp.getFullYear();
    this.fields.update(ff => ({ ...ff, expiryDate: `${dd}-${mm}-${yyyy}` }));
    this.trigger();
  }

  countryHasManual(code: string): boolean {
    return code in MANUAL_DATA;
  }

  private triggerSubject = new Subject<void>();
  private triggerSub?: Subscription;

  ngOnDestroy() { this.triggerSub?.unsubscribe(); }

  patch(key: keyof ForgeFields, val: string) {
    this.fields.update(f => ({ ...f, [key]: val }));
  }

  patchName(key: 'lastname' | 'firstname', val: string) {
    const clean = val.replace(/[а-яёА-ЯЁ]/g, '').toUpperCase();
    this.fields.update(f => ({ ...f, [key]: clean }));
  }

  // ── Document number generation ────────────────────────────
  // Verified against manuals in /manuals directory
  // Spec: fmt string (P=fixed prefix char, L=rand letter, D=rand digit, X=rand alphanum)
  // prefix field from MANUAL_DATA is prepended, fmt covers remaining chars only
  private readonly DOC_NUM_SPECS: Record<string, { fmt: string; hint: string }> = {
    // Europe — verified vs manuals
    AUT: { fmt: 'LDDDDDDDD',  hint: 'P12345678'   }, // 1L+8D
    BEL: { fmt: 'DDDDDDD',    hint: 'EH1234567'   }, // prefix EH + 7D (manual: EH+6D, padded to 9)
    BGR: { fmt: 'DDDDDDD',    hint: '381234567'   }, // prefix 38 + 7D
    HRV: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    CYP: { fmt: 'LLDDDDDD',   hint: 'AB123456'    }, // 2L+6D
    CZE: { fmt: 'LLDDDDDD',   hint: 'AB123456'    }, // 2L+6D (8 total per manual)
    DNK: { fmt: 'DDDDDDDDD',  hint: '123456789'   }, // 9D
    EST: { fmt: 'DDDDDDD',    hint: 'KD1234567'   }, // prefix KD/KE/KC + 7D
    FIN: { fmt: 'DDDDDDD',    hint: 'FP1234567'   }, // prefix FP + 7D
    FRA: { fmt: 'DDDDD',      hint: 'CA12345'     }, // regional prefix(2L) + 5D + 2D (handled in genDocNum)
    DEU: { fmt: 'XXXXXXXXX',  hint: 'C01X00T47'   }, // 1(CFGHJK) + 8 alphanum (handled in genDocNum)
    GRC: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    HUN: { fmt: 'DDDDDDD',    hint: 'BA1234567'   }, // prefix BA + 7D
    ISL: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    IRL: { fmt: 'DDDDDDD',    hint: 'PA1234567'   }, // prefix PA + 7D
    ITA: { fmt: 'LLDDDDDDD',  hint: 'YA1234567'   }, // 2L+7D (manual: 2L+7D)
    LVA: { fmt: 'DDDDDDD',    hint: 'LV1234567'   }, // prefix LV + 7D
    LIE: { fmt: 'LDDDDDDDD',  hint: 'L12345678'   }, // 1L+8D
    LTU: { fmt: 'LLLDDDDDD',  hint: 'ABC123456'   }, // 3L+6D
    LUX: { fmt: 'LLDDDDDD',   hint: 'AB123456'    }, // 2L+6D
    MLT: { fmt: 'DDDDDDD',    hint: '1234567'     }, // 7D
    MCO: { fmt: 'LLDDDDDDDD', hint: 'AB12345678'  }, // 2L+8D
    MNE: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    NLD: { fmt: 'LLLDDDDDD',  hint: 'NKF81R2T6'   }, // 3L+6D per manual (with check char)
    MKD: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    NOR: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    POL: { fmt: 'LLLDDDDDDD', hint: 'EAP123456'   }, // 3L+6D per manual
    PRT: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    ROU: { fmt: 'DDDDDDDD',   hint: '01234567'    }, // prefix 0 + 7D (8 total)
    SRB: { fmt: 'DDDDDDDDD',  hint: '123456789'   }, // 9D
    SVK: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    SVN: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    ESP: { fmt: 'LDDDDDD',    hint: 'PAA123456'   }, // prefix P + region(2L) + 6D (handled)
    SWE: { fmt: 'DDDDDDD',    hint: '51234567'    }, // year-digit + 7D (handled in genDocNum)
    CHE: { fmt: 'DDDDDDD',    hint: 'A1234567'    }, // prefix A + 7D
    // Non-EU Europe
    ALB: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   },
    AND: { fmt: 'LLDDDDDDDD', hint: 'AB12345678'  },
    BIH: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   },
    GBR: { fmt: 'DDDDDDDDD',  hint: '123456789'   }, // 9D
    XKX: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   },
    // Americas + Oceania
    USA: { fmt: 'LDDDDDDDD',  hint: 'A12345678'   }, // 1L+8D
    CAN: { fmt: 'LLDDDDDDD',  hint: 'AB1234567'   }, // 2L+7D
    AUS: { fmt: 'DDDDDDD',    hint: 'PA1234567'   }, // prefix PA + 7D
    BRA: { fmt: 'LLDDDDDDD',  hint: 'AA1234567'   }, // 2L+7D
    NZL: { fmt: 'LDDDDDDDD',  hint: 'A12345678'   }, // 1L+8D
  };

  canGenDocNum = computed(() => {
    const f = this.fields();
    const code = f.issuer || f.nationality;
    return code in this.DOC_NUM_SPECS;
  });

  docNumPlaceholder = computed(() => {
    const f = this.fields();
    const code = f.issuer || f.nationality;
    return this.DOC_NUM_SPECS[code]?.hint ?? 'e.g. AB1234567';
  });

  genDocNum() {
    const code = this.fields().issuer || this.fields().nationality;
    const spec = this.DOC_NUM_SPECS[code];
    if (!spec) return;

    const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
    const L  = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    const D  = '0123456789';
    const X  = L + D;
    const rndFmt = (fmt: string) => fmt.split('').map(c => {
      if (c === 'L') return L[ri(0, L.length - 1)];
      if (c === 'D') return D[ri(0, 9)];
      if (c === 'X') return X[ri(0, X.length - 1)];
      return c;
    }).join('');

    let result = '';
    const manual = MANUAL_DATA[code];

    switch (code) {
      case 'DEU': {
        const first = 'CFGHJK'[ri(0, 5)];
        const DEU_X = '0123456789CFGHJKLMNPRTUVWXYZ';
        const rest = Array.from({length: 8}, () => DEU_X[ri(0, DEU_X.length - 1)]).join('');
        result = first + rest;
        break;
      }
      case 'FRA': {
        const prefixes = manual?.docNumPrefixOptions ?? ['CA','CK','DE','CH','BE','AD','CP','CT','CL','FD'];
        const pfx = prefixes[ri(0, prefixes.length - 1)];
        result = pfx + Array.from({length: 5}, () => D[ri(0,9)]).join('') + Array.from({length: 2}, () => D[ri(0,9)]).join('');
        break;
      }
      case 'ESP': {
        const regions = ['AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN'];
        const pfx = 'P' + regions[ri(0, regions.length - 1)];
        result = pfx + Array.from({length: 6}, () => D[ri(0,9)]).join('');
        break;
      }
      case 'SWE': {
        const yearDigit = String(new Date().getFullYear()).slice(-1);
        result = yearDigit + Array.from({length: 7}, () => D[ri(0,9)]).join('');
        break;
      }
      case 'EST': {
        const series = (manual?.docNumPrefixOptions ?? ['KD','KE','KC'])[ri(0, 2)];
        result = series + Array.from({length: 7}, () => D[ri(0,9)]).join('');
        break;
      }
      case 'BGR': { result = '38' + Array.from({length: 7}, () => D[ri(0,9)]).join(''); break; }
      case 'HUN': { result = 'BA' + Array.from({length: 7}, () => D[ri(0,9)]).join(''); break; }
      case 'FIN': { result = 'FP' + Array.from({length: 7}, () => D[ri(0,9)]).join(''); break; }
      case 'LVA': { result = 'LV' + Array.from({length: 7}, () => D[ri(0,9)]).join(''); break; }
      case 'CHE': { result = 'A'  + Array.from({length: 7}, () => D[ri(0,9)]).join(''); break; }
      case 'BEL': { result = 'EH' + Array.from({length: 6}, () => D[ri(0,9)]).join(''); break; }
      case 'AUS': { result = 'PA' + Array.from({length: 7}, () => D[ri(0,9)]).join(''); break; }
      case 'IRL': { result = 'PA' + Array.from({length: 7}, () => D[ri(0,9)]).join(''); break; }
      case 'ROU': { result = '0'  + Array.from({length: 7}, () => D[ri(0,9)]).join(''); break; }
      default:
        result = manual?.docNumPrefix
          ? manual.docNumPrefix + rndFmt(spec.fmt)
          : rndFmt(spec.fmt);
    }

    this.fields.update(f => ({ ...f, docNum: result }));
    this.trigger();
  }

  private formatDate(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 8) return `${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4)}`;
    return raw;
  }

  patchDate(key: 'birthDate' | 'expiryDate', val: string) {
    this.fields.update(f => ({ ...f, [key]: this.formatDate(val) }));
  }

  trigger() {
    if (!this.canGenerate()) return;
    this.triggerSubject.next();
  }

  private initTrigger() {
    this.triggerSub = this.triggerSubject.pipe(
      debounceTime(250),
      switchMap(() => {
        const f = this.fields();
        const lines = [
          f.docType, f.lastname, f.firstname, f.birthDate,
          f.nationality, f.sex, f.docNum, f.expiryDate,
          f.issuer, f.subType, f.persNum, f.optional,
        ];
        const fd = new FormData();
        fd.append('type', 'mrz_gen');
        fd.append('lines', JSON.stringify(lines));
        this.store.loading.set(true);
        return this.http.post<MrzGenResult>('/api/execute', fd);
      })
    ).subscribe({
      next: res => { this.store.loading.set(false); this.store.mrzGenResult.set(res); this.saveHistory(res, this.fields()); },
      error: () => this.store.loading.set(false),
    });
  }

  // ── Presets ──────────────────────────────────────────────
  private customPresets = signal<Preset[]>(this.loadCustomPresets());

  allPresets = computed(() => [...DEFAULT_PRESETS, ...this.customPresets()]);

  isActivePreset(p: Preset) {
    const f = this.fields();
    return f.docType === p.docType && f.nationality === p.nat && f.issuer === p.issuer;
  }

  applyPreset(p: Preset) {
    this.fields.set({
      docType: p.docType, nationality: p.nat, issuer: p.issuer,
      subType: p.subType ?? '',
      lastname: '', firstname: '', birthDate: '', sex: 'M',
      docNum: '', expiryDate: '', persNum: '', optional: '',
    });
    this.store.mrzGenResult.set(null);
    this.step.set(3);
    this.syncUrl();
  }

  canSavePreset() {
    const f = this.fields();
    if (!f.docType || !f.nationality || !f.issuer) return false;
    return !this.allPresets().some(p => p.docType === f.docType && p.nat === f.nationality && p.issuer === f.issuer);
  }

  savePreset() {
    const f = this.fields();
    const label = `${f.nationality} ${f.docType}`;
    const next = [...this.customPresets(), { label, docType: f.docType, nat: f.nationality, issuer: f.issuer, custom: true }];
    this.customPresets.set(next);
    localStorage.setItem('mrz_presets', JSON.stringify(next));
  }

  deletePreset(label: string) {
    const next = this.customPresets().filter(p => p.label !== label);
    this.customPresets.set(next);
    localStorage.setItem('mrz_presets', JSON.stringify(next));
  }

  private loadCustomPresets(): Preset[] {
    try { return JSON.parse(localStorage.getItem('mrz_presets') || '[]'); } catch { return []; }
  }

  flagUrl(code3: string) { return flagUrl(code3); }

  isNeutralSex = computed(() => {
    const f = this.fields();
    return ['DEU', 'AUT', 'CHE'].some(c => f.nationality === c || f.issuer === c);
  });

  // ── Personal number generator ─────────────────────────────
  private readonly PERS_NUM_SPECS: Record<string, { label: string; hint: string }> = {
    // USA: Alien Registration Number (ICN format on passport)
    USA: { label: 'GEN ICN', hint: 'ICN e.g. 617533091<1930' },
    // Canada: SIN — 9 digits, no leading 0 or 8
    CAN: { label: 'GEN SIN', hint: 'SIN e.g. 123456789' },
    // UK: NINo — LL999999L
    GBR: { label: 'GEN NINo', hint: 'NINo e.g. AB123456C' },
    // Australia: TFN — 9 digits with check digit
    AUS: { label: 'GEN TFN', hint: 'TFN e.g. 123456782' },
    // Brazil: CPF — 11 digits with 2 check digits
    BRA: { label: 'GEN CPF', hint: 'CPF e.g. 12345678909' },
    // Netherlands: BSN — 9 digits (11-proof)
    NLD: { label: 'GEN BSN', hint: 'BSN e.g. 123456782' },
    // Ireland: PPS — 7D + 1L + optional 1L
    IRL: { label: 'GEN PPS', hint: 'PPS e.g. 1234567A' },
    // Germany: Steueridentifikationsnummer — 11 digits
    DEU: { label: 'GEN Steuer-ID', hint: 'e.g. 12345678901' },
    // Sweden: personnummer — YYMMDD-XXXX
    SWE: { label: 'GEN Persnr', hint: 'e.g. 900101-1234' },
    // Norway: personnummer — 11 digits
    NOR: { label: 'GEN Persnr', hint: 'e.g. 12345678901' },
    // Denmark: CPR — DDMMYY-XXXX
    DNK: { label: 'GEN CPR', hint: 'e.g. 1234567890' },
    // Finland: henkilötunnus — DDMMYY+XXXC
    FIN: { label: 'GEN HETU', hint: 'e.g. 010190-1234' },
    // Spain: NIE/NIF — X1234567L
    ESP: { label: 'GEN NIE', hint: 'e.g. X1234567L' },
    // Romania: CNP — 13 digits
    ROU: { label: 'GEN CNP', hint: 'e.g. 1234567890123' },
    // France: INSEE — 15 digits
    FRA: { label: 'GEN INSEE', hint: 'e.g. 123456789012345' },
    // Belgium: NISS — 11 digits
    BEL: { label: 'GEN NISS', hint: 'e.g. 85010112345' },
    // Austria: Sozialversicherungsnummer — 10 digits
    AUT: { label: 'GEN SVNr', hint: 'e.g. 1234010190' },
    // Poland: PESEL — 11 digits
    POL: { label: 'GEN PESEL', hint: 'e.g. 90010112345' },
    // Czech Republic: Rodné číslo — YYMMDD/XXXX
    CZE: { label: 'GEN RČ', hint: 'e.g. 900101/1234' },
    // Slovakia: Rodné číslo (same format as CZ)
    SVK: { label: 'GEN RČ', hint: 'e.g. 900101/1234' },
    // Hungary: TAJ — 9 digits
    HUN: { label: 'GEN TAJ', hint: 'e.g. 123456789' },
    // Portugal: NIF — 9 digits
    PRT: { label: 'GEN NIF', hint: 'e.g. 123456789' },
    // Greece: AMKA — 11 digits
    GRC: { label: 'GEN AMKA', hint: 'e.g. 01019012345' },
    // Estonia: isikukood — 11 digits (1+YYMMDD+seq+check)
    EST: { label: 'GEN IK', hint: 'e.g. 39001011234' },
    // Latvia: personas kods — 6D-5D
    LVA: { label: 'GEN PK', hint: 'e.g. 010190-12345' },
    // Lithuania: asmens kodas — 11 digits
    LTU: { label: 'GEN AK', hint: 'e.g. 39001011234' },
    // Croatia: OIB — 11 digits
    HRV: { label: 'GEN OIB', hint: 'e.g. 12345678901' },
    // Slovenia: EMŠO — 13 digits
    SVN: { label: 'GEN EMŠO', hint: 'e.g. 0101990500123' },
    // Bulgaria: EGN — 10 digits
    BGR: { label: 'GEN EGN', hint: 'e.g. 9001011234' },
    // Luxembourg: Matricule — 13 digits
    LUX: { label: 'GEN Mat.', hint: 'e.g. 1234567890123' },
  };

  canGenPersNum = computed(() => {
    const f = this.fields();
    const code = f.nationality || f.issuer;
    return code in this.PERS_NUM_SPECS;
  });

  persNumLabel = computed(() => {
    const f = this.fields();
    const code = f.nationality || f.issuer;
    return this.PERS_NUM_SPECS[code]?.label ?? 'GEN';
  });

  persNumPlaceholder = computed(() => {
    const f = this.fields();
    const code = f.nationality || f.issuer;
    return this.PERS_NUM_SPECS[code]?.hint ?? 'Optional';
  });

  genPersNum() {
    const f = this.fields();
    const code = f.nationality || f.issuer;
    const result = this.generatePersNum(code, f.birthDate, f.sex);
    if (result) {
      this.fields.update(ff => ({ ...ff, persNum: result }));
      this.trigger();
    }
  }

  private generatePersNum(code: string, birthDate: string, sex: string): string {
    const rd = (n: number) => this.randDigits(n);
    const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
    const rl = () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[ri(0, 25)];

    // Parse birthDate DD-MM-YYYY
    const m = birthDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    const bd = m ? { d: m[1], mo: m[2], y: m[3], yy: m[3].slice(2) } : null;

    switch (code) {
      case 'USA': {
        const icn = rd(9);
        const batch = rd(4);
        const raw = icn + '<' + batch;
        return raw + this.mrzCheckDigit(raw);
      }
      case 'CAN': {
        // SIN: first digit 1-7 (not 0 or 8/9 for real SINs, simplified)
        return String(ri(1, 7)) + rd(8);
      }
      case 'GBR': {
        // NINo: 2 letters (not D,F,I,Q,U,V as first; not D,F,I,O,Q,U,V as second) + 6D + suffix A-D
        const badFirst = ['D','F','I','Q','U','V'];
        const badSecond = [...badFirst, 'O'];
        let l1: string, l2: string;
        do { l1 = rl(); } while (badFirst.includes(l1));
        do { l2 = rl(); } while (badSecond.includes(l2));
        return l1 + l2 + rd(6) + 'ABCD'[ri(0,3)];
      }
      case 'AUS': {
        // TFN: 9 digits with check digit (weights 1,4,3,7,5,8,6,9,10)
        const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
        let digits: number[];
        let check: number;
        do {
          digits = [ri(1,9), ...Array.from({length:7}, () => ri(0,9))];
          const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
          check = (11 - (sum % 11)) % 11;
        } while (check === 10);
        digits.push(check === 11 ? 0 : check);
        return digits.join('');
      }
      case 'BRA': {
        // CPF: 9 digits + 2 check digits
        const n = Array.from({length:9}, () => ri(0,9));
        const d1 = (n.reduce((acc, v, i) => acc + v * (10 - i), 0) * 10 % 11) % 10;
        const d2 = ([...n, d1].reduce((acc, v, i) => acc + v * (11 - i), 0) * 10 % 11) % 10;
        return [...n, d1, d2].join('');
      }
      case 'NLD': {
        // BSN: 9 digits, passes 11-check: sum of d[i]*(9-i) for i=0..7, minus d[8], divisible by 11
        let digits: number[];
        do {
          digits = [ri(1,9), ...Array.from({length:8}, () => ri(0,9))];
          const sum = digits.slice(0,8).reduce((acc, d, i) => acc + d * (9 - i), 0) - digits[8];
          if (sum % 11 === 0) break;
        } while (true);
        return digits.join('');
      }
      case 'IRL': {
        // PPS: 7D + 1L (suffix W for women, A for men, or random)
        return rd(7) + (sex === 'F' ? 'W' : 'A');
      }
      case 'DEU': {
        // Steuer-ID: 11 digits, first ≠ 0, no digit appears >3 times
        return String(ri(1,9)) + rd(10);
      }
      case 'SWE': {
        // Personnummer: YYMMDD-XXXX
        if (!bd) return rd(6) + '-' + rd(4);
        return bd.yy + bd.mo + bd.d + '-' + rd(4);
      }
      case 'NOR': {
        // 11 digits: DDMMYY + individual (3D) + 2 check digits (simplified)
        if (!bd) return rd(11);
        return bd.d + bd.mo + bd.yy + rd(5);
      }
      case 'DNK': {
        // CPR: DDMMYY-XXXX
        if (!bd) return rd(6) + rd(4);
        return bd.d + bd.mo + bd.yy + rd(4);
      }
      case 'FIN': {
        // HETU: DDMMYY+XXXC (century marker + 3D + check char)
        const century = bd && +bd.y >= 2000 ? 'A' : '-';
        const base = (bd ? bd.d + bd.mo + bd.yy : rd(6)) + century + rd(3);
        const chars = '0123456789ABCDEFHJKLMNPRSTUVWXY';
        const check = chars[parseInt(base.replace(/\D/g,'').slice(0,9)) % 31];
        return base + check;
      }
      case 'ESP': {
        // NIE: X/Y/Z + 7D + letter (check)
        const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
        const prefix = ['X','Y','Z'][ri(0,2)];
        const num = rd(7);
        const idx = parseInt((prefix === 'X' ? '0' : prefix === 'Y' ? '1' : '2') + num) % 23;
        return prefix + num + letters[idx];
      }
      case 'ROU': {
        // CNP: 1D (sex/century) + YYMMDD + 2D (county) + 3D (seq) + 1D (check)
        const s = sex === 'F' ? (bd && +bd.y >= 2000 ? '6' : '2') : (bd && +bd.y >= 2000 ? '5' : '1');
        return s + (bd ? bd.yy + bd.mo + bd.d : rd(6)) + String(ri(1,46)).padStart(2,'0') + rd(3) + rd(1);
      }
      case 'FRA': {
        // INSEE: 1(sex) + YY + MM + dept(2-3D) + commune(3D) + order(3D) + key(2D)
        const s = sex === 'F' ? '2' : '1';
        return s + (bd ? bd.yy + bd.mo : rd(4)) + String(ri(1,95)).padStart(2,'0') + rd(3) + rd(3) + rd(3) + rd(2);
      }
      case 'BEL': {
        // NISS: YY MM DD 3D(seq) 2D(check) — simplified
        return (bd ? bd.yy + bd.mo + bd.d : rd(6)) + String(ri(1,999)).padStart(3,'0') + rd(2);
      }
      case 'AUT': {
        // SVNr: 10 digits — 3D(seq) + DDMMYY
        return String(ri(100,999)) + (bd ? bd.d + bd.mo + bd.yy : rd(6)) + rd(1);
      }
      case 'POL': {
        // PESEL: YYMMDD + 3D(seq) + 1D(sex: odd=M, even=F) + 1D(check)
        const seq = String(ri(0,99)).padStart(2,'0') + (sex === 'M' ? String(ri(0,4)*2+1) : String(ri(0,4)*2));
        return (bd ? bd.yy + bd.mo + bd.d : rd(6)) + seq + rd(1);
      }
      case 'CZE':
      case 'SVK': {
        // Rodné číslo: YYMMDD/XXXX (women: month+50)
        if (!bd) return rd(6) + '/' + rd(4);
        const mo = sex === 'F' ? String(+bd.mo + 50).padStart(2,'0') : bd.mo;
        return bd.yy + mo + bd.d + '/' + rd(4);
      }
      case 'HUN': {
        return rd(9);
      }
      case 'PRT': {
        return rd(9);
      }
      case 'GRC': {
        // AMKA: DDMMYY + 5D
        return (bd ? bd.d + bd.mo + bd.yy : rd(6)) + rd(5);
      }
      case 'EST':
      case 'LTU': {
        // Isikukood/Asmens kodas: 1D(century+sex) + YYMMDD + 3D(seq) + 1D(check)
        const g = sex === 'M' ? (bd && +bd.y >= 2000 ? '5' : '3') : (bd && +bd.y >= 2000 ? '6' : '4');
        return g + (bd ? bd.yy + bd.mo + bd.d : rd(6)) + rd(4);
      }
      case 'LVA': {
        // Personas kods: DDMMYY-CXXXX
        const century = bd && +bd.y >= 2000 ? '2' : '1';
        return (bd ? bd.d + bd.mo + bd.yy : rd(6)) + '-' + century + rd(4);
      }
      case 'HRV': {
        return rd(11);
      }
      case 'SVN': {
        // EMŠO: DDMMYYY (year is 3 digits!) + 2D(area) + 3D(seq) + 1D(check)
        return (bd ? bd.d + bd.mo + (bd.y.slice(1)) : rd(7)) + String(ri(1,99)).padStart(2,'0') + rd(4);
      }
      case 'BGR': {
        // EGN: YYMMDD (women: month+40) + 3D(region+seq) + 1D(check)
        if (!bd) return rd(10);
        const mo = sex === 'F' ? String(+bd.mo + 40).padStart(2,'0') : bd.mo;
        return bd.yy + mo + bd.d + rd(4);
      }
      case 'LUX': {
        return rd(13);
      }
      default:
        return '';
    }
  }

  private randDigits(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += i === 0 ? String(Math.floor(Math.random() * 9) + 1) : String(Math.floor(Math.random() * 10));
    return s;
  }

  private mrzCheckDigit(s: string): number {
    const weights = [7, 3, 1];
    const val = (c: string) => {
      if (c === '<') return 0;
      if (c >= '0' && c <= '9') return +c;
      return c.charCodeAt(0) - 55;
    };
    const sum = s.split('').reduce((acc, c, i) => acc + val(c) * weights[i % 3], 0);
    return sum % 10;
  }

  // ── Copy ─────────────────────────────────────────────────
  linkCopied = signal(false);

  copy(t: string, key: string) {
    navigator.clipboard.writeText(t);
    this.copiedKey.set(key);
    setTimeout(() => this.copiedKey.set(null), 1500);
  }

  shareLink() {
    navigator.clipboard.writeText(window.location.href);
    this.linkCopied.set(true);
    setTimeout(() => this.linkCopied.set(false), 1500);
  }

  // ── History ──────────────────────────────────────────────
  private loadHistory(): HistoryEntry[] {
    try { return JSON.parse(localStorage.getItem('mrz_history') || '[]'); } catch { return []; }
  }

  private saveHistory(result: MrzGenResult, fields: ForgeFields) {
    const next = [{ result, fields }, ...this.genHistory()].slice(0, 5);
    this.genHistory.set(next);
    localStorage.setItem('mrz_history', JSON.stringify(next));
  }

  restoreHistory(h: HistoryEntry) {
    this.fields.set({ ...h.fields });
    this.store.mrzGenResult.set(h.result);
    this.step.set(3);
    this.syncUrl();
  }

  // ── Random fill ──────────────────────────────────────────
  private readonly LASTNAMES = ['SMITH','JOHNSON','WILLIAMS','BROWN','JONES','GARCIA','MILLER','DAVIS','WILSON','MOORE','TAYLOR','ANDERSON','THOMAS','JACKSON'];
  private readonly FIRSTNAMES = ['JAMES','JOHN','ROBERT','MICHAEL','WILLIAM','DAVID','RICHARD','EMMA','OLIVIA','AVA','ISABELLA','SOPHIA','CHARLOTTE','MIA'];

  randomize() {
    const rnd = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const rndDigits = (n: number) => Array.from({length: n}, (_, i) => i === 0 ? String(Math.floor(Math.random()*9)+1) : String(Math.floor(Math.random()*10))).join('');
    const rndAlnum = (n: number) => Array.from({length: n}, () => 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'[Math.floor(Math.random()*33)]).join('');

    const now = new Date();
    const birthYear = now.getFullYear() - Math.floor(Math.random() * 40 + 18);
    const birthMonth = Math.floor(Math.random() * 12) + 1;
    const birthDay = Math.floor(Math.random() * 28) + 1;
    const birthDate = `${String(birthDay).padStart(2,'0')}-${String(birthMonth).padStart(2,'0')}-${birthYear}`;

    const expiryYear = now.getFullYear() + Math.floor(Math.random() * 8 + 2);
    const expiryMonth = Math.floor(Math.random() * 12) + 1;
    const expiryDay = Math.floor(Math.random() * 28) + 1;
    const expiryDate = `${String(expiryDay).padStart(2,'0')}-${String(expiryMonth).padStart(2,'0')}-${expiryYear}`;

    const sex = ['M','F'][Math.floor(Math.random() * 2)];
    const docNum = rndAlnum(2) + rndDigits(7);

    this.fields.update(f => ({
      ...f,
      lastname: rnd(this.LASTNAMES),
      firstname: rnd(this.FIRSTNAMES),
      birthDate,
      sex,
      docNum,
      expiryDate,
    }));
    this.trigger();
  }

  clearFields() {
    this.fields.update(f => ({
      ...f,
      lastname: '', firstname: '', birthDate: '',
      sex: 'M', docNum: '', expiryDate: '', persNum: '', optional: '',
    }));
    this.store.mrzGenResult.set(null);
  }

  // ── Reset ────────────────────────────────────────────────
  reset() {
    this.fields.set({ docType:'', nationality:'', issuer:'', lastname:'', firstname:'',
      birthDate:'', sex:'M', docNum:'', expiryDate:'', subType:'', persNum:'', optional:'' });
    this.step.set(1);
    this.natSearch.set('');
    this.issuerSearch.set('');
    this.store.mrzGenResult.set(null);
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }
}
