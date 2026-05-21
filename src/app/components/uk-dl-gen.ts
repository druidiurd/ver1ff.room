import { Component, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UK_ADDRESSES } from './uk-dl-addresses';

/*
  UK DVLA Driving Licence Number — official format (16 chars + suffix):

  Pos  1- 5: Surname (first 5 chars, padded with 9, MAC→MC)
  Pos  6   : Decade digit of birth year  e.g. 1988 → 8
  Pos  7- 8: Birth month (01-12 male; female first digit +5, e.g. Aug=08 → 58)
  Pos  9-10: Birth day (DD)
  Pos 11   : Unit digit of birth year   e.g. 1988 → 8
  Pos 12-13: First two initials (firstname[0] + middlename[0], pad with 9)
  Pos 14   : Arbitrary digit (DVLA internal, always 9)
  Pos 15-16: Two computer-generated random letters

  Printed separately (after space): 2-digit random suffix

  Real examples:
    SLOWE810168AM9NM 25   — Alistair Malcolm Slowe, 16.10.1988, M
    HASSA908276A98FG 39   — Hassan Aghyad, 27.08.1996, M
    BICI9905163A99FM 30   — Altin Bici, 16.05.1993, M
    LANE9704113AC9MG 56   — Adam Christian Lane, 11.04.1973, M (2023+ revision)
*/

interface DlFields {
  surname: string;
  firstname: string;
  middlename: string;
  dob: string;
  sex: 'M' | 'F';
  randomSuffix: string;
  licenceType: 'standard' | 'group2'; // standard=10yr, group2 HGV/Bus=5yr
}

interface DocData {
  dlNumber:       string;
  randomSuffix:   string;
  cardSerial:     string;
  issueDate:      string;  // DD.MM.YYYY
  expiryDate:     string;
  categoryExpiry: string;
  amAIssue:       string;
  bIssue:         string;
  validityYears:  number;
  categories:     string; // field 9
  address:        string; // field 8
}

const SURNAMES = [
  'SMITH','JONES','WILLIAMS','TAYLOR','BROWN','DAVIES','EVANS','WILSON',
  'THOMAS','ROBERTS','JOHNSON','WALKER','WRIGHT','ROBINSON','THOMPSON',
  'WHITE','HUGHES','EDWARDS','GREEN','HALL','WOOD','HARRIS','LEWIS',
  'MARTIN','JACKSON','CLARKE','CLARK','TURNER','HILL','SCOTT',
];
const FIRSTNAMES_M = [
  'JAMES','JOHN','ROBERT','MICHAEL','WILLIAM','DAVID','RICHARD','JOSEPH',
  'THOMAS','CHARLES','CHRISTOPHER','DANIEL','MATTHEW','ANTHONY','MARK',
  'DONALD','STEVEN','PAUL','ANDREW','KENNETH','GEORGE','JOSHUA','KEVIN',
];
const FIRSTNAMES_F = [
  'MARY','PATRICIA','JENNIFER','LINDA','BARBARA','ELIZABETH','SUSAN',
  'JESSICA','SARAH','KAREN','LISA','NANCY','BETTY','MARGARET','SANDRA',
  'ASHLEY','DOROTHY','KIMBERLY','EMILY','DONNA','MICHELLE','CAROL',
];

interface HistoryEntry {
  dlNumber:  string;
  suffix:    string;
  name:      string;
  dob:       string;
  rev:       '2015' | '2023';
  euVariant: boolean;
  ts:        number;
  // restore fields
  surname:    string;
  firstname:  string;
  middlename: string;
  sex:        'M' | 'F';
  licenceType: 'standard' | 'group2';
}

const LS_KEY = 'uk_dl_history';

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, 10)));
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CARD_PREFIXES = ['FH', 'BF', 'FC', 'FD'];


function addYears(d: Date, y: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + y);
  return r;
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function randDate(from: Date, to: Date): Date {
  return new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime()));
}

function luhnSerial(): string {
  const prefix = CARD_PREFIXES[Math.floor(Math.random() * CARD_PREFIXES.length)];
  const base = String(Math.floor(Math.random() * 9000000) + 1000000);
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    let d = parseInt(base[base.length - 1 - i], 10);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return `${prefix}${base}${(10 - (sum % 10)) % 10}`;
}

function buildDocData(f: DlFields, dlNumber: string, suffix: string, revision: '2015' | '2023', euVariant = false): DocData {
  const m = f.dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return { dlNumber, randomSuffix: suffix, cardSerial: '', issueDate: '', expiryDate: '', categoryExpiry: '', amAIssue: '', bIssue: '', validityYears: 10, categories: '', address: '' };

  const dob = new Date(+m[3], +m[2] - 1, +m[1]);
  const now = new Date();

  const catExp = addYears(dob, 70);
  catExp.setDate(catExp.getDate() - 1);

  let issueDate: Date;
  if (revision === '2023') {
    const from = new Date(2023, 9, 1); // Oct 2023
    issueDate = randDate(from, now);
  } else if (euVariant) {
    const from = new Date(2015, 2, 1);  // Mar 2015
    const to   = new Date(2021, 5, 30); // Jun 2021 — EU cards only pre-Brexit redesign
    issueDate = randDate(from, to);
  } else {
    const from = new Date(2021, 6, 1);  // Jul 2021 — post-Brexit no Welsh
    const to   = new Date(2023, 8, 30); // Sep 2023
    issueDate = randDate(from, to);
  }

  const validityYears = f.licenceType === 'group2' ? 5 : 10;
  const exp = addYears(issueDate, validityYears);
  exp.setDate(exp.getDate() - 1);
  const expiryDate = exp < catExp ? exp : catExp;

  const amFrom = new Date(now.getFullYear() - 20, 0, 1);
  const amTo   = new Date(now.getFullYear() - 10, 11, 31);
  const amAIssue = randDate(amFrom, amTo);

  const bFrom = addYears(dob, 20);
  const bTo   = addYears(dob, 22);
  const bIssue = randDate(bFrom, bTo);

  const isGroup2 = f.licenceType === 'group2';
  const categories = isGroup2
    ? 'AM/A/B/B1/BE/C1/C/D1/D/C1E/CE/D1E/DE/f/k/l/n/p/q'
    : 'AM/A/B/B1/BE/f/k/p/q';

  const address = UK_ADDRESSES[Math.floor(Math.random() * UK_ADDRESSES.length)];

  return {
    dlNumber, randomSuffix: suffix,
    cardSerial:     luhnSerial(),
    issueDate:      fmtDate(issueDate),
    expiryDate:     fmtDate(expiryDate),
    categoryExpiry: fmtDate(catExp),
    amAIssue:       fmtDate(amAIssue),
    bIssue:         fmtDate(bIssue),
    validityYears,
    categories,
    address,
  };
}

function buildSurnamePart(surname: string): string {
  let s = surname.toUpperCase().replace(/'/g,'').replace(/-/g,'').replace(/\s/g,'');
  if (s.startsWith('MAC') && s.length > 3) s = 'MC' + s.slice(3);
  while (s.length < 5) s += '9';
  return s.slice(0, 5);
}

function buildDlNumber(f: DlFields): string {
  const m = f.dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return '????????????????';
  const dd = m[1], mm = m[2], yyyy = m[3];
  const yy = yyyy.slice(2);
  const decade = yy[0], unit = yy[1];
  const monthNum = parseInt(mm, 10);
  const monthEnc = f.sex === 'F'
    ? `${Math.floor(monthNum / 10) + 5}${monthNum % 10}`
    : mm;
  const surPart = buildSurnamePart(f.surname);
  const init1 = (f.firstname?.[0] ?? '9').toUpperCase();
  const init2 = (f.middlename?.[0] ?? '9').toUpperCase();
  const seed1 = (surPart.charCodeAt(0) + surPart.charCodeAt(1) + parseInt(dd, 10)) % 26;
  const seed2 = (surPart.charCodeAt(2) + surPart.charCodeAt(3) + parseInt(mm, 10)) % 26;
  return surPart + decade + monthEnc + dd + unit + init1 + init2 + '9' + LETTERS[seed1] + LETTERS[seed2];
}

@Component({
  selector: 'app-uk-dl-gen',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="dl-wrap">
      <div class="dl-header mono">UK_DL_GENERATOR</div>
      <div class="dl-sub mono">DVLA · Driver Licence Number · 16 chars · 2015–2023+ revisions</div>

      <div class="dl-cols">
        <!-- LEFT: form + breakdown -->
        <div class="dl-form">

          <div class="dl-actions-top">
            <button type="button" class="btn-rnd mono" (click)="randomize()">⚡ RANDOM</button>
            <button type="button" class="btn-clr mono" (click)="clear()">✕ CLEAR</button>
          </div>

          <div class="field-group">
            <label class="mono fg-label">SURNAME</label>
            <input class="mono fg-input"
              [ngModel]="fields().surname"
              (ngModelChange)="patchUpper('surname', $event)"
              placeholder="SLOWE" autocomplete="off" spellcheck="false">
            <span class="fg-hint mono">First 5 chars · MAC→MC · pad 9</span>
          </div>

          <div class="dl-row2">
            <div class="field-group">
              <label class="mono fg-label">FIRST_NAME</label>
              <input class="mono fg-input"
                [ngModel]="fields().firstname"
                (ngModelChange)="patchUpper('firstname', $event)"
                placeholder="ALISTAIR" autocomplete="off" spellcheck="false">
            </div>
            <div class="field-group">
              <label class="mono fg-label">MIDDLE <span class="opt">opt</span></label>
              <input class="mono fg-input"
                [ngModel]="fields().middlename"
                (ngModelChange)="patchUpper('middlename', $event)"
                placeholder="MALCOLM" autocomplete="off" spellcheck="false">
            </div>
          </div>

          <div class="dl-row2">
            <div class="field-group">
              <label class="mono fg-label">DATE_OF_BIRTH</label>
              <input class="mono fg-input" [class.input-error]="dobError()"
                [ngModel]="fields().dob"
                (ngModelChange)="patchDob($event)"
                placeholder="DD-MM-YYYY" autocomplete="off">
              @if (dobError()) { <span class="fg-err mono">invalid date</span> }
            </div>
            <div class="field-group">
              <label class="mono fg-label">SEX</label>
              <div class="sex-group">
                @for (s of ['M','F']; track s) {
                  <button type="button" class="sex-btn mono"
                    [class.active]="fields().sex === s"
                    (click)="patch('sex', s)">{{ s }}</button>
                }
              </div>
              <span class="fg-hint mono">Female: month +5</span>
            </div>
          </div>

          <div class="field-group">
            <label class="mono fg-label">LICENCE_TYPE</label>
            <div class="type-group">
              <button type="button" class="type-btn mono"
                [class.active]="fields().licenceType === 'standard'"
                (click)="patch('licenceType', 'standard')">
                <span class="type-icon">🚗</span> STANDARD <span class="type-sub">10yr</span>
              </button>
              <button type="button" class="type-btn mono"
                [class.active]="fields().licenceType === 'group2'"
                (click)="patch('licenceType', 'group2')">
                <span class="type-icon">🚛</span> GROUP 2 <span class="type-sub">5yr · HGV/Bus</span>
              </button>
            </div>
          </div>

          <button type="button" class="btn-gen mono"
            [disabled]="!canGenerate()"
            (click)="generate()">
            <span>›</span> GENERATE
          </button>

          <!-- History -->
          @if (history().length > 0) {
            <div class="history-block">
              <div class="hist-header mono">// RECENT_GENERATIONS</div>
              @for (entry of history(); track entry.ts) {
                <div class="hist-row" (click)="restoreFromHistory(entry)">
                  <span class="hist-dl mono">{{ entry.dlNumber }} {{ entry.suffix }}</span>
                  <span class="hist-name mono">{{ entry.name }}</span>
                  <span class="hist-rev mono" [class.rev-eu]="entry.euVariant">{{ entry.euVariant ? 'EU' : entry.rev === '2023' ? '2023+' : '2021' }}</span>
                </div>
              }
            </div>
          }

        </div>

        <!-- RIGHT: output -->
        <div class="dl-output">

          @if (result()) {
            <!-- DL number card -->
            <div class="dl-card fade-in">
              <div class="dl-card-label mono">DRIVING_LICENCE_NUMBER</div>
              <div class="dl-number mono">
                <span class="dl-main">{{ result() }}</span>
                <span class="dl-issue-sep"> </span>
                <span class="dl-issue">{{ fields().randomSuffix }}</span>
              </div>
              <!-- Format reference inline -->
              <div class="ref-visual mono">
                <span class="rv-part surname">{{ result()!.slice(0,5) }}</span>
                <span class="rv-part dob">{{ result()!.slice(5,11) }}</span>
                <span class="rv-part init">{{ result()!.slice(11,13) }}</span>
                <span class="rv-part arb">{{ result()!.slice(13,14) }}</span>
                <span class="rv-part code">{{ result()!.slice(14,16) }}</span>
                <span class="rv-sep"> </span>
                <span class="rv-part issue">{{ fields().randomSuffix }}</span>
              </div>
              <div class="ref-legend">
                <span class="rl-item surname mono">SURNAME</span>
                <span class="rl-item dob mono">DOB</span>
                <span class="rl-item init mono">INITIALS</span>
                <span class="rl-item arb mono">ARB</span>
                <span class="rl-item code mono">LETTERS</span>
                <span class="rl-item issue mono">SUFFIX</span>
              </div>
              <div class="dl-copy-row">
                <button type="button" class="btn-copy mono" [class.copied]="copied() === 'full'" (click)="copy('full')">
                  {{ copied() === 'full' ? '✓ COPIED' : 'COPY FULL' }}
                </button>
                <button type="button" class="btn-copy btn-copy-alt mono" [class.copied]="copied() === 'dl'" (click)="copy('dl')">
                  {{ copied() === 'dl' ? '✓ COPIED' : 'COPY DL ONLY' }}
                </button>
              </div>
            </div>

            <!-- Full document data -->
            @if (docData()) {
              <div class="doc-block fade-in">
                <div class="doc-header-row">
                  <span class="doc-header mono">// FULL_DOCUMENT_DATA</span>
                  <div class="doc-header-actions">
                    <div class="rev-selector">
                      <button class="rev-btn mono rev-btn-eu" [class.active]="selectedRevision() === '2015' && euVariant()" (click)="setRevision('2015'); euVariant.set(true)">EU (2015–21)</button>
                      <button class="rev-btn mono" [class.active]="selectedRevision() === '2015' && !euVariant()" (click)="setRevision('2015'); euVariant.set(false)">2021–23</button>
                      <button class="rev-btn mono" [class.active]="selectedRevision() === '2023'" (click)="setRevision('2023'); euVariant.set(false)">2023+</button>
                    </div>
                    <button type="button" class="btn-copy-all mono" [class.copied]="copied() === 'all'" (click)="copyAll()">
                      {{ copied() === 'all' ? '✓ COPIED' : '⎘ COPY ALL' }}
                    </button>
                  </div>
                </div>

                <div class="doc-two-col">
                  <!-- Left: fields -->
                  <div class="doc-card">
                    <div class="doc-field">
                      <span class="df-num mono">1.</span>
                      <span class="df-label mono">SURNAME</span>
                      <span class="df-val mono">{{ fields().surname }}</span>
                    </div>
                    <div class="doc-field">
                      <span class="df-num mono">2.</span>
                      <span class="df-label mono">FIRST NAME</span>
                      <span class="df-val mono">{{ fields().firstname }}{{ fields().middlename ? ' ' + fields().middlename : '' }}</span>
                    </div>
                    <div class="doc-field">
                      <span class="df-num mono">3.</span>
                      <span class="df-label mono">DOB</span>
                      <span class="df-val mono">{{ dobFormatted() }}</span>
                    </div>
                    <div class="doc-field">
                      <span class="df-num mono">8.</span>
                      <span class="df-label mono">ADDRESS</span>
                      <span class="df-val mono df-dim">{{ docData()!.address }}</span>
                    </div>
                    <div class="doc-sep"></div>
                    <div class="doc-field">
                      <span class="df-num mono">4a.</span>
                      <span class="df-label mono">ISSUED</span>
                      <span class="df-val mono">{{ docData()!.issueDate }}</span>
                    </div>
                    <div class="doc-field">
                      <span class="df-num mono">4b.</span>
                      <span class="df-label mono">EXPIRES</span>
                      <span class="df-val mono">{{ docData()!.expiryDate }}</span>
                    </div>
                    <div class="doc-field">
                      <span class="df-num mono">4c.</span>
                      <span class="df-label mono">CAT EXP</span>
                      <span class="df-val mono df-dim">{{ docData()!.categoryExpiry }}</span>
                    </div>
                    <div class="doc-field">
                      <span class="df-num mono">5.</span>
                      <span class="df-label mono">SERIAL</span>
                      <span class="df-val mono df-accent">{{ docData()!.cardSerial }}</span>
                    </div>
                    <div class="doc-field">
                      <span class="df-num mono"></span>
                      <span class="df-label mono">VALIDITY</span>
                      <span class="validity-badge mono" [class.group2]="fields().licenceType === 'group2'">
                        {{ docData()!.validityYears }}yr · {{ fields().licenceType === 'group2' ? 'GROUP 2 HGV/BUS' : 'STANDARD' }}
                      </span>
                    </div>
                    <div class="doc-sep"></div>
                    <div class="doc-field">
                      <span class="df-num mono">DL</span>
                      <span class="df-label mono">NUMBER</span>
                      <span class="df-val mono df-green">{{ docData()!.dlNumber }} {{ docData()!.randomSuffix }}</span>
                    </div>
                    <div class="doc-sep"></div>
                    <div class="doc-cats">
                      <div class="cat-row">
                        <span class="cat-name mono">AM/A</span>
                        <span class="cat-from mono">{{ docData()!.amAIssue }}</span>
                        <span class="cat-to mono">{{ docData()!.categoryExpiry }}</span>
                      </div>
                      <div class="cat-row">
                        <span class="cat-name mono">B/B1/BE</span>
                        <span class="cat-from mono">{{ docData()!.bIssue }}</span>
                        <span class="cat-to mono">{{ docData()!.categoryExpiry }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Right: SVG card preview -->
                  <div class="card-preview-col">
                    <div class="rev-badge mono" [class.rev-new]="isNewRevision()" [class.rev-eu]="euVariant()">
                      {{ isNewRevision() ? '◈ 2023+ REVISION' : euVariant() ? '◈ PRE-2021 · EU VARIANT' : '◈ 2021–2023 REVISION' }}
                    </div>
                    <div class="rev-card-wrap">
                      @if (isNewRevision()) { <!-- 2023+ blue -->
                        <svg class="rev-card" viewBox="0 0 420 265" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="bg23a" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stop-color="#d6eaf8"/>
                              <stop offset="100%" stop-color="#aed6f1"/>
                            </linearGradient>
                            <pattern id="wp23" width="90" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
                              <text y="10" font-size="7" fill="rgba(70,130,180,0.12)" font-family="Arial" letter-spacing="2">DRIVING LICENCE</text>
                            </pattern>
                          </defs>
                          <!-- Card body -->
                          <rect width="420" height="265" rx="14" fill="url(#bg23a)"/>
                          <rect width="420" height="265" rx="14" fill="url(#wp23)"/>
                          <!-- Blue header -->
                          <rect width="420" height="46" rx="14" fill="#00247d"/>
                          <rect y="32" width="420" height="14" fill="#00247d"/>
                          <!-- UK text -->
                          <text x="14" y="33" font-size="26" font-weight="900" fill="white" font-family="Arial Black,Arial" letter-spacing="-1">UK</text>
                          <text x="62" y="32" font-size="13" font-weight="700" fill="white" font-family="Arial" letter-spacing="0.5">DRIVING LICENCE</text>
                          <!-- Union Jack -->
                          <g transform="translate(362,7)">
                            <rect width="46" height="30" rx="3" fill="#012169"/>
                            <line x1="0" y1="0" x2="46" y2="30" stroke="white" stroke-width="5"/>
                            <line x1="46" y1="0" x2="0" y2="30" stroke="white" stroke-width="5"/>
                            <line x1="0" y1="0" x2="46" y2="30" stroke="#C8102E" stroke-width="3"/>
                            <line x1="46" y1="0" x2="0" y2="30" stroke="#C8102E" stroke-width="3"/>
                            <rect x="19" y="0" width="8" height="30" fill="white"/>
                            <rect x="0" y="11" width="46" height="8" fill="white"/>
                            <rect x="20" y="0" width="6" height="30" fill="#C8102E"/>
                            <rect x="0" y="12" width="46" height="6" fill="#C8102E"/>
                          </g>
                          <!-- Photo area -->
                          <rect x="13" y="54" width="72" height="88" rx="3" fill="#c8d8e8" stroke="#a0b8cc" stroke-width="1"/>
                          <text x="49" y="95" text-anchor="middle" font-size="7" fill="#7090a0" font-family="Arial">PHOTO</text>
                          <!-- Expiry stamp on photo -->
                          <rect x="13" y="131" width="72" height="11" rx="0" fill="rgba(0,36,125,0.75)"/>
                          <text x="49" y="139" text-anchor="middle" font-size="6.5" fill="white" font-family="Arial" font-weight="700">{{ docData()!.expiryDate.slice(3,5) }}/{{ docData()!.expiryDate.slice(8) }}</text>
                          <!-- Fields -->
                          <text x="94" y="65" font-size="7.5" fill="#111" font-family="Arial" font-weight="700">1.  {{ fields().surname }}</text>
                          <text x="94" y="78" font-size="7.5" fill="#111" font-family="Arial" font-weight="700">2.  {{ fields().firstname }}{{ fields().middlename ? ' ' + fields().middlename : '' }}</text>
                          <text x="94" y="94" font-size="7" fill="#222" font-family="Arial">3.  {{ dobFormatted() }}</text>
                          <text x="94" y="107" font-size="7" fill="#222" font-family="Arial">4a. {{ docData()!.issueDate }}  4c. DVLA</text>
                          <text x="94" y="120" font-size="7" fill="#222" font-family="Arial">4b. {{ docData()!.expiryDate }}</text>
                          <text x="94" y="136" font-size="8" fill="#000" font-family="Courier New,monospace" font-weight="700">5.  {{ docData()!.dlNumber }} {{ docData()!.randomSuffix }}</text>
                          <!-- Royal crest outline -->
                          <ellipse cx="376" cy="175" rx="30" ry="36" fill="none" stroke="rgba(180,30,30,0.35)" stroke-width="1.5"/>
                          <ellipse cx="376" cy="165" rx="18" ry="20" fill="none" stroke="rgba(180,30,30,0.25)" stroke-width="1"/>
                          <text x="376" y="168" text-anchor="middle" font-size="6" fill="rgba(180,30,30,0.45)" font-family="Arial">ROYAL</text>
                          <text x="376" y="177" text-anchor="middle" font-size="6" fill="rgba(180,30,30,0.45)" font-family="Arial">CREST</text>
                          <text x="376" y="200" text-anchor="middle" font-size="5.5" fill="rgba(0,36,125,0.4)" font-family="Arial" letter-spacing="0.5">DIEU ET MON DROIT</text>
                          <!-- Signature line -->
                          <line x1="94" y1="165" x2="250" y2="165" stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>
                          <text x="95" y="163" font-size="6" fill="rgba(0,0,0,0.3)" font-family="Arial">7.</text>
                          <!-- Address -->
                          <text x="13" y="195" font-size="6.5" fill="#333" font-family="Arial">8.  {{ docData()!.address }}</text>
                          <!-- Categories -->
                          <text x="13" y="210" font-size="6.5" fill="#333" font-family="Arial">9.  {{ docData()!.categories }}</text>
                          <!-- Bottom strip -->
                          <rect x="0" y="250" width="420" height="15" rx="0" fill="rgba(0,36,125,0.06)"/>
                          <text x="210" y="260" text-anchor="middle" font-size="6" fill="rgba(0,36,125,0.5)" font-family="Arial" letter-spacing="2">REVISION 2023+ · NO WELSH TEXT · ROYAL CREST</text>
                        </svg>
                      } @else if (!euVariant()) { <!-- 2015 post-Brexit pink -->
                        <svg class="rev-card" viewBox="0 0 420 265" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="bg15a" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stop-color="#f5e8ee"/>
                              <stop offset="100%" stop-color="#e8d0dc"/>
                            </linearGradient>
                            <pattern id="wp15" width="90" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
                              <text y="10" font-size="7" fill="rgba(180,80,120,0.13)" font-family="Arial" letter-spacing="2">DRIVING LICENCE</text>
                            </pattern>
                          </defs>
                          <rect width="420" height="265" rx="14" fill="url(#bg15a)"/>
                          <rect width="420" height="265" rx="14" fill="url(#wp15)"/>
                          <rect width="420" height="46" rx="14" fill="#00247d"/>
                          <rect y="32" width="420" height="14" fill="#00247d"/>
                          <text x="14" y="33" font-size="26" font-weight="900" fill="white" font-family="Arial Black,Arial" letter-spacing="-1">UK</text>
                          <text x="62" y="32" font-size="13" font-weight="700" fill="white" font-family="Arial" letter-spacing="0.5">DRIVING LICENCE</text>
                          <g transform="translate(362,7)">
                            <rect width="46" height="30" rx="3" fill="#012169"/>
                            <line x1="0" y1="0" x2="46" y2="30" stroke="white" stroke-width="5"/>
                            <line x1="46" y1="0" x2="0" y2="30" stroke="white" stroke-width="5"/>
                            <line x1="0" y1="0" x2="46" y2="30" stroke="#C8102E" stroke-width="3"/>
                            <line x1="46" y1="0" x2="0" y2="30" stroke="#C8102E" stroke-width="3"/>
                            <rect x="19" y="0" width="8" height="30" fill="white"/>
                            <rect x="0" y="11" width="46" height="8" fill="white"/>
                            <rect x="20" y="0" width="6" height="30" fill="#C8102E"/>
                            <rect x="0" y="12" width="46" height="6" fill="#C8102E"/>
                          </g>
                          <rect x="13" y="54" width="72" height="88" rx="3" fill="#d8c8cc" stroke="#b8a0a8" stroke-width="1"/>
                          <text x="49" y="95" text-anchor="middle" font-size="7" fill="#907080" font-family="Arial">PHOTO</text>
                          <rect x="13" y="131" width="72" height="11" rx="0" fill="rgba(0,36,125,0.75)"/>
                          <text x="49" y="139" text-anchor="middle" font-size="6.5" fill="white" font-family="Arial" font-weight="700">{{ docData()!.expiryDate.slice(3,5) }}/{{ docData()!.expiryDate.slice(8) }}</text>
                          <text x="94" y="65" font-size="7.5" fill="#111" font-family="Arial" font-weight="700">1.  {{ fields().surname }}</text>
                          <text x="94" y="78" font-size="7.5" fill="#111" font-family="Arial" font-weight="700">2.  {{ fields().firstname }}{{ fields().middlename ? ' ' + fields().middlename : '' }}</text>
                          <text x="94" y="94" font-size="7" fill="#222" font-family="Arial">3.  {{ dobFormatted() }}</text>
                          <text x="94" y="107" font-size="7" fill="#222" font-family="Arial">4a. {{ docData()!.issueDate }}  4c. DVLA</text>
                          <text x="94" y="120" font-size="7" fill="#222" font-family="Arial">4b. {{ docData()!.expiryDate }}</text>
                          <text x="94" y="136" font-size="8" fill="#000" font-family="Courier New,monospace" font-weight="700">5.  {{ docData()!.dlNumber }} {{ docData()!.randomSuffix }}</text>
                          <line x1="94" y1="165" x2="310" y2="165" stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>
                          <text x="95" y="163" font-size="6" fill="rgba(0,0,0,0.3)" font-family="Arial">7.</text>
                          <text x="13" y="195" font-size="6.5" fill="#333" font-family="Arial">8.  {{ docData()!.address }}</text>
                          <text x="13" y="210" font-size="6.5" fill="#333" font-family="Arial">9.  {{ docData()!.categories }}</text>
                          <rect x="0" y="250" width="420" height="15" rx="0" fill="rgba(160,60,100,0.06)"/>
                          <text x="210" y="260" text-anchor="middle" font-size="6" fill="rgba(160,60,100,0.5)" font-family="Arial" letter-spacing="2">REVISION 2021–2023 · POST-BREXIT · PINK</text>
                        </svg>
                      } @else { <!-- pre-2021 EU circle -->
                        <svg class="rev-card" viewBox="0 0 420 265" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="bgEU" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stop-color="#f5e8ee"/>
                              <stop offset="100%" stop-color="#e8d0dc"/>
                            </linearGradient>
                            <pattern id="wpEU" width="90" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
                              <text y="10" font-size="7" fill="rgba(180,80,120,0.13)" font-family="Arial" letter-spacing="2">DRIVING LICENCE</text>
                            </pattern>
                          </defs>
                          <rect width="420" height="265" rx="14" fill="url(#bgEU)"/>
                          <rect width="420" height="265" rx="14" fill="url(#wpEU)"/>
                          <rect width="420" height="46" rx="14" fill="#00247d"/>
                          <rect y="32" width="420" height="14" fill="#00247d"/>
                          <text x="14" y="30" font-size="11" font-weight="700" fill="white" font-family="Arial" letter-spacing="0.3">DRIVING LICENCE</text>
                          <text x="14" y="42" font-size="9" fill="rgba(255,255,255,0.75)" font-family="Arial" letter-spacing="0.2">TRWYDDED YRRU</text>
                          <!-- EU circle -->
                          <g transform="translate(356,4)">
                            <circle cx="29" cy="19" r="19" fill="#003399"/>
                            <circle cx="29" cy="19" r="16" fill="none" stroke="#FFCC00" stroke-width="0.5" stroke-dasharray="2,3"/>
                            <!-- 12 EU stars at r=12 -->
                            <g fill="#FFCC00" font-size="5" font-family="Arial" text-anchor="middle">
                              <text x="29" y="9">★</text>
                              <text x="35" y="11">★</text>
                              <text x="39" y="16">★</text>
                              <text x="39" y="23">★</text>
                              <text x="35" y="28">★</text>
                              <text x="29" y="31">★</text>
                              <text x="23" y="28">★</text>
                              <text x="19" y="23">★</text>
                              <text x="19" y="16">★</text>
                              <text x="23" y="11">★</text>
                            </g>
                            <text x="29" y="22" text-anchor="middle" font-size="7" font-weight="900" fill="white" font-family="Arial">UK</text>
                          </g>
                          <rect x="13" y="54" width="72" height="88" rx="3" fill="#d8c8cc" stroke="#b8a0a8" stroke-width="1"/>
                          <text x="49" y="95" text-anchor="middle" font-size="7" fill="#907080" font-family="Arial">PHOTO</text>
                          <rect x="13" y="131" width="72" height="11" rx="0" fill="rgba(0,36,125,0.75)"/>
                          <text x="49" y="139" text-anchor="middle" font-size="6.5" fill="white" font-family="Arial" font-weight="700">{{ docData()!.expiryDate.slice(3,5) }}/{{ docData()!.expiryDate.slice(8) }}</text>
                          <text x="94" y="65" font-size="7.5" fill="#111" font-family="Arial" font-weight="700">1.  {{ fields().surname }}</text>
                          <text x="94" y="78" font-size="7.5" fill="#111" font-family="Arial" font-weight="700">2.  {{ fields().firstname }}{{ fields().middlename ? ' ' + fields().middlename : '' }}</text>
                          <text x="94" y="94" font-size="7" fill="#222" font-family="Arial">3.  {{ dobFormatted() }}</text>
                          <text x="94" y="107" font-size="7" fill="#222" font-family="Arial">4a. {{ docData()!.issueDate }}  4c. DVLA</text>
                          <text x="94" y="120" font-size="7" fill="#222" font-family="Arial">4b. {{ docData()!.expiryDate }}</text>
                          <text x="94" y="136" font-size="8" fill="#000" font-family="Courier New,monospace" font-weight="700">5.  {{ docData()!.dlNumber }} {{ docData()!.randomSuffix }}</text>
                          <line x1="94" y1="165" x2="310" y2="165" stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>
                          <text x="95" y="163" font-size="6" fill="rgba(0,0,0,0.3)" font-family="Arial">7.</text>
                          <text x="13" y="195" font-size="6.5" fill="#333" font-family="Arial">8.  {{ docData()!.address }}</text>
                          <text x="13" y="210" font-size="6.5" fill="#333" font-family="Arial">9.  {{ docData()!.categories }}</text>
                          <rect x="0" y="250" width="420" height="15" rx="0" fill="rgba(0,51,153,0.06)"/>
                          <text x="210" y="260" text-anchor="middle" font-size="6" fill="rgba(0,51,153,0.5)" font-family="Arial" letter-spacing="2">PRE-2021 · EU CIRCLE · WELSH TEXT</text>
                        </svg>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }
          }

          @if (!result()) {
            <div class="dl-placeholder mono">
              <div class="ph-icon">🪪</div>
              <div>FILL FIELDS → GENERATE</div>
              <div class="ph-sub">DVLA format · 16 chars · 2015–2023+ revisions</div>
            </div>
          }

        </div>
      </div>
    </div>
  `,
  styles: [`
    .dl-wrap {
      display: flex; flex-direction: column; gap: 8px;
      height: 100%; padding: 4px 0;
    }
    .dl-header { font-size: 0.55rem; font-weight: 800; color: var(--green); letter-spacing: 3px; }
    .dl-sub { font-size: 0.48rem; color: var(--text-dim); letter-spacing: 2px; margin-bottom: 4px; }

    .dl-cols { display: flex; gap: 20px; flex: 1; min-height: 0; }
    .dl-form {
      width: 300px; flex-shrink: 0;
      display: flex; flex-direction: column; gap: 10px;
      overflow-y: auto; padding-right: 4px;
    }
    .dl-output {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 10px;
      overflow-y: auto;
    }

    .dl-actions-top { display: flex; gap: 8px; }
    .btn-rnd {
      padding: 6px 12px; background: rgba(255,149,0,0.1);
      border: 1px solid rgba(255,149,0,0.35); border-radius: var(--radius-sm);
      color: #ff9500; font-size: 0.52rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .btn-rnd:hover { background: rgba(255,149,0,0.2); }
    .btn-clr {
      padding: 6px 12px; background: none;
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      color: var(--text-dim); font-size: 0.52rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .btn-clr:hover { border-color: #ff4444; color: #ff4444; }

    .field-group { display: flex; flex-direction: column; gap: 3px; }
    .dl-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .fg-label { font-size: 0.45rem; font-weight: 700; color: var(--text-dim); letter-spacing: 1.5px; }
    .opt { font-weight: 400; opacity: 0.6; }
    .fg-input {
      background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 6px 9px;
      color: var(--green); font-size: 0.7rem; font-weight: 700;
      outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box;
    }
    .fg-input:focus { border-color: var(--border-green); }
    .fg-input.input-error { border-color: rgba(255,68,68,0.6); }
    .fg-hint { font-size: 0.4rem; color: var(--text-dim); letter-spacing: 0.5px; opacity: 0.7; }
    .fg-err  { font-size: 0.4rem; color: #ff4444; }

    /* Licence type selector */
    .type-group { display: flex; flex-direction: column; gap: 5px; }
    .type-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 10px; background: none;
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      color: var(--text-dim); font-size: 0.5rem; font-weight: 700;
      cursor: pointer; transition: 0.15s; font-family: inherit; text-align: left;
    }
    .type-btn.active { background: var(--green-dim); border-color: var(--green); color: var(--green); }
    .type-btn:hover:not(.active) { border-color: var(--text-dim); }
    .type-icon { font-size: 0.8rem; }
    .type-sub { font-weight: 400; opacity: 0.7; margin-left: 2px; }

    /* Validity badge */
    .validity-badge {
      font-size: 0.48rem; font-weight: 700; letter-spacing: 1px;
      padding: 2px 8px; border-radius: 3px;
      background: rgba(0,255,65,0.08); border: 1px solid var(--border-green);
      color: var(--green);
    }
    .validity-badge.group2 {
      background: rgba(255,149,0,0.1); border-color: rgba(255,149,0,0.4); color: #ff9500;
    }

    .sex-group { display: flex; gap: 5px; }
    .sex-btn {
      flex: 1; padding: 7px 4px;
      background: none; border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-dim);
      font-size: 0.6rem; font-weight: 800; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .sex-btn.active { background: var(--green-dim); border-color: var(--green); color: var(--green); }

    .btn-gen {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 10px 20px;
      background: var(--green); color: #000;
      border: none; border-radius: var(--radius-sm);
      font-size: 0.65rem; font-weight: 800; letter-spacing: 2px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .btn-gen:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-gen:disabled { opacity: 0.35; cursor: not-allowed; }

    /* History — in left col */
    .history-block {
      background: rgba(0,0,0,0.3); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 10px 12px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .hist-header { font-size: 0.42rem; color: var(--text-dim); letter-spacing: 2px; margin-bottom: 4px; }
    .hist-row {
      display: flex; align-items: baseline; gap: 6px;
      padding: 4px 6px; border-radius: 3px; cursor: pointer;
      transition: background 0.12s;
    }
    .hist-row:hover { background: rgba(0,255,65,0.05); }
    .hist-dl  { font-size: 0.52rem; font-weight: 800; color: var(--green); flex-shrink: 0; letter-spacing: 1px; }
    .hist-name { font-size: 0.42rem; color: var(--text-dim); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hist-rev { font-size: 0.38rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; flex-shrink: 0;
      background: rgba(0,255,65,0.08); border: 1px solid var(--border-green); color: var(--green); }
    .hist-rev.rev-eu { background: rgba(0,51,153,0.12); border-color: rgba(255,204,0,0.4); color: #003399; }

    /* DL card */
    .dl-card {
      background: rgba(0,0,0,0.5); border: 1px solid var(--border-green);
      border-radius: var(--radius-sm); padding: 16px 20px;
      display: flex; flex-direction: column; gap: 8px;
      box-shadow: 0 0 20px rgba(0,255,65,0.05);
    }
    .dl-card-label { font-size: 0.42rem; font-weight: 700; color: var(--text-dim); letter-spacing: 3px; }
    .dl-number {
      font-size: 1.2rem; font-weight: 800; letter-spacing: 4px;
      display: flex; align-items: baseline;
    }
    .dl-main  { color: var(--green); text-shadow: 0 0 14px rgba(0,255,65,0.5); }
    .dl-issue-sep { color: var(--text-dim); }
    .dl-issue { color: #ff9500; text-shadow: 0 0 10px rgba(255,149,0,0.4); }

    /* Format reference inline */
    .ref-visual { font-size: 0.75rem; font-weight: 800; letter-spacing: 2px; }
    .rv-part.surname { color: #007aff; }
    .rv-part.dob     { color: #ff9500; }
    .rv-part.init    { color: #a855f7; }
    .rv-part.arb     { color: var(--text-dim); }
    .rv-part.code    { color: var(--green); }
    .rv-part.issue   { color: #ff9500; opacity: 0.8; }
    .rv-sep { color: var(--text-dim); }
    .ref-legend { display: flex; gap: 6px; flex-wrap: wrap; }
    .rl-item {
      font-size: 0.38rem; font-weight: 700; letter-spacing: 1px;
      padding: 1px 6px; border-radius: 3px;
    }
    .rl-item.surname { color: #007aff; background: rgba(0,122,255,0.1); border: 1px solid rgba(0,122,255,0.25); }
    .rl-item.dob     { color: #ff9500; background: rgba(255,149,0,0.1); border: 1px solid rgba(255,149,0,0.25); }
    .rl-item.init    { color: #a855f7; background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.25); }
    .rl-item.arb     { color: var(--text-dim); background: rgba(255,255,255,0.04); border: 1px solid var(--border); }
    .rl-item.code    { color: var(--green); background: var(--green-dim); border: 1px solid var(--border-green); }
    .rl-item.issue   { color: #ff9500; background: rgba(255,149,0,0.1); border: 1px solid rgba(255,149,0,0.25); }

    .dl-copy-row { display: flex; gap: 8px; }
    .btn-copy {
      background: var(--green-dim); border: 1px solid var(--border-green);
      color: var(--green); font-size: 0.48rem; font-weight: 700;
      padding: 4px 12px; border-radius: 4px; cursor: pointer; letter-spacing: 1px;
      font-family: inherit; transition: 0.15s; min-width: 80px; text-align: center;
    }
    .btn-copy.copied { background: var(--green); color: #000; }
    .btn-copy-alt { background: none; border-color: var(--border); color: var(--text-dim); }
    .btn-copy-alt:hover { border-color: var(--green); color: var(--green); }
    .btn-copy-alt.copied { background: var(--green); color: #000; border-color: var(--green); }

    /* Full document block */
    .doc-block {
      background: rgba(0,0,0,0.35); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 12px 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .doc-header-row {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .doc-header { font-size: 0.42rem; color: var(--text-dim); letter-spacing: 2px; }
    .doc-header-actions { display: flex; align-items: center; gap: 8px; }

    /* Revision selector */
    .rev-selector {
      display: flex; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden;
    }
    .rev-btn {
      padding: 3px 10px; background: none; border: none;
      color: var(--text-dim); font-size: 0.45rem; font-weight: 700; letter-spacing: 0.5px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .rev-btn:not(:last-child) { border-right: 1px solid var(--border); }
    .rev-btn.active { background: var(--green); color: #000; }
    .rev-btn-eu.active { background: #003399; color: #FFCC00; }

    .btn-copy-all {
      background: rgba(0,255,65,0.07); border: 1px solid var(--border-green);
      color: var(--green); font-size: 0.45rem; font-weight: 700;
      padding: 3px 10px; border-radius: 4px; cursor: pointer; letter-spacing: 1px;
      font-family: inherit; transition: 0.15s;
    }
    .btn-copy-all:hover { background: rgba(0,255,65,0.14); }
    .btn-copy-all.copied { background: var(--green); color: #000; }

    /* Two-col layout inside doc block */
    .doc-two-col { display: flex; gap: 14px; align-items: flex-start; }
    .doc-card { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 180px; }
    .doc-sep { height: 1px; background: var(--border); margin: 2px 0; }
    .doc-field { display: flex; align-items: baseline; gap: 6px; }
    .df-num   { font-size: 0.4rem; color: var(--text-dim); opacity: 0.5; width: 22px; flex-shrink: 0; }
    .df-label { font-size: 0.42rem; color: var(--text-dim); width: 72px; flex-shrink: 0; }
    .df-val   { font-size: 0.58rem; font-weight: 700; color: var(--text); letter-spacing: 0.5px; }
    .df-dim   { color: var(--text-dim); }
    .df-accent { color: #ff9500; }
    .df-green  { color: var(--green); }

    .doc-cats { display: flex; flex-direction: column; gap: 3px; }
    .cat-row  { display: flex; gap: 8px; align-items: baseline; }
    .cat-name { font-size: 0.5rem; font-weight: 700; color: var(--green); width: 56px; flex-shrink: 0; }
    .cat-from { font-size: 0.5rem; color: var(--text); }
    .cat-to   { font-size: 0.45rem; color: var(--text-dim); }
    .cat-to::before { content: '→ '; opacity: 0.5; }

    /* Card preview */
    .card-preview-col { width: 350px; flex-shrink: 0; display: flex; flex-direction: column; gap: 5px; }
    .rev-badge {
      font-size: 0.4rem; font-weight: 700; letter-spacing: 1.5px;
      padding: 2px 8px; border-radius: 3px; align-self: flex-start;
      background: rgba(160,60,100,0.12); border: 1px solid rgba(160,60,100,0.3); color: #b04070;
    }
    .rev-badge.rev-new {
      background: rgba(0,36,125,0.1); border-color: rgba(0,36,125,0.3); color: #00247d;
    }
    .rev-badge.rev-eu {
      background: rgba(0,51,153,0.12); border-color: rgba(255,204,0,0.5); color: #003399;
    }
    .rev-card-wrap { border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.4); width: 350px; }
    .rev-card { width: 350px; height: auto; display: block; }

    /* Placeholder */
    .dl-placeholder {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; height: 100%; min-height: 200px;
      color: var(--text-dim); font-size: 0.52rem; letter-spacing: 2px; text-align: center;
    }
    .ph-icon { font-size: 2.5rem; opacity: 0.3; }
    .ph-sub  { font-size: 0.42rem; opacity: 0.5; }

    @media (max-width: 1100px) {
      .doc-two-col { flex-direction: column; }
      .card-preview-col { width: 100%; }
    }
    @media (max-width: 900px) {
      .dl-cols { flex-direction: column; }
      .dl-form { width: 100%; overflow-y: visible; }
    }
    @media (max-width: 600px) {
      .dl-row2 { grid-template-columns: 1fr; }
    }
  `]
})
export class UkDlGenComponent implements OnInit {
  fields = signal<DlFields>({
    surname: '', firstname: '', middlename: '',
    dob: '', sex: 'M', randomSuffix: '01', licenceType: 'standard'
  });
  result           = signal<string | null>(null);
  docData          = signal<DocData | null>(null);
  selectedRevision = signal<'2015' | '2023'>('2023');
  euVariant        = signal(false);
  copied           = signal<'full' | 'dl' | 'all' | null>(null);
  history          = signal<HistoryEntry[]>([]);

  isNewRevision = computed(() => this.selectedRevision() === '2023');

  ngOnInit() { this.history.set(loadHistory()); }

  dobFormatted = computed(() => {
    const m = this.fields().dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    return m ? `${m[1]}.${m[2]}.${m[3]}` : this.fields().dob;
  });

  dobError = computed(() => {
    const d = this.fields().dob;
    if (!d) return false;
    return !/^\d{2}-\d{2}-\d{4}$/.test(d);
  });

  canGenerate = computed(() => {
    const f = this.fields();
    return !!(f.surname && f.firstname && f.dob && !this.dobError());
  });

  breakdown = computed(() => {
    const dl = this.result();
    if (!dl || dl.length !== 16) return [];
    const f = this.fields();
    return [
      { pos: '01–05', val: dl.slice(0,5),   label: 'Surname (padded 9)' },
      { pos: '06',    val: dl[5],            label: 'Decade of birth year' },
      { pos: '07–08', val: dl.slice(6,8),   label: `Month${f.sex==='F'?' (+5 female)':''}` },
      { pos: '09–10', val: dl.slice(8,10),  label: 'Birth day' },
      { pos: '11',    val: dl[10],           label: 'Year unit digit' },
      { pos: '12',    val: dl[11],           label: 'First name initial' },
      { pos: '13',    val: dl[12],           label: 'Middle initial (9 if none)' },
      { pos: '14',    val: dl[13],           label: 'Arbitrary (always 9)' },
      { pos: '15–16', val: dl.slice(14,16), label: 'Random letters' },
      { pos: 'SFX',   val: f.randomSuffix,  label: 'Random 2-digit suffix' },
    ];
  });

  patch(key: keyof DlFields, val: string) {
    this.fields.update(f => ({ ...f, [key]: val }));
    // regenerate docData when licenceType changes so validity/dates update immediately
    if (key === 'licenceType') {
      const dl = this.result();
      if (dl) {
        const f = this.fields();
        this.docData.set(buildDocData(f, dl, f.randomSuffix, this.selectedRevision(), this.euVariant()));
      }
    }
  }

  patchUpper(key: keyof DlFields, val: string) {
    this.fields.update(f => ({ ...f, [key]: val.toUpperCase().replace(/[^A-Z'\- ]/g,'') }));
  }

  patchDob(val: string) {
    const d = val.replace(/\D/g,'');
    if (d.length === 8) val = `${d.slice(0,2)}-${d.slice(2,4)}-${d.slice(4)}`;
    this.fields.update(f => ({ ...f, dob: val }));
  }

  setRevision(rev: '2015' | '2023') {
    this.selectedRevision.set(rev);
    const dl = this.result();
    if (dl) {
      const suffix = this.fields().randomSuffix;
      this.docData.set(buildDocData(this.fields(), dl, suffix, rev, this.euVariant()));
    }
  }

  generate() {
    if (!this.canGenerate()) return;
    const suffix = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    this.fields.update(f => ({ ...f, randomSuffix: suffix }));
    const dl = buildDlNumber(this.fields());
    this.result.set(dl);
    this.docData.set(buildDocData(this.fields(), dl, suffix, this.selectedRevision(), this.euVariant()));
    this.pushHistory(dl, suffix);
  }

  private pushHistory(dl: string, suffix: string) {
    const f = this.fields();
    const entry: HistoryEntry = {
      dlNumber: dl, suffix,
      name: `${f.surname}, ${f.firstname}${f.middlename ? ' ' + f.middlename[0] : ''}`,
      dob: f.dob, rev: this.selectedRevision(),
      euVariant: this.euVariant(), ts: Date.now(),
      surname: f.surname, firstname: f.firstname, middlename: f.middlename,
      sex: f.sex, licenceType: f.licenceType,
    };
    const updated = [entry, ...this.history()].slice(0, 10);
    this.history.set(updated);
    saveHistory(updated);
  }

  restoreFromHistory(entry: HistoryEntry) {
    this.selectedRevision.set(entry.rev);
    this.euVariant.set(entry.euVariant);
    this.fields.set({
      surname: entry.surname, firstname: entry.firstname,
      middlename: entry.middlename, dob: entry.dob,
      sex: entry.sex, licenceType: entry.licenceType,
      randomSuffix: entry.suffix,
    });
    this.result.set(entry.dlNumber);
    this.docData.set(buildDocData(this.fields(), entry.dlNumber, entry.suffix, entry.rev, entry.euVariant));
  }

  copy(type: 'full' | 'dl') {
    const r = this.result();
    if (!r) return;
    const text = type === 'full' ? `${r} ${this.fields().randomSuffix}` : r;
    navigator.clipboard.writeText(text);
    this.copied.set(type);
    setTimeout(() => this.copied.set(null), 1500);
  }

  copyAll() {
    const d = this.docData();
    if (!d) return;
    const f = this.fields();
    const text = [
      `SURNAME:        ${f.surname}`,
      `FIRST NAME:     ${f.firstname}${f.middlename ? ' ' + f.middlename : ''}`,
      `DATE OF BIRTH:  ${this.dobFormatted()}`,
      `ADDRESS:        ${d.address}`,
      ``,
      `4a. ISSUED:     ${d.issueDate}`,
      `4b. EXPIRES:    ${d.expiryDate}`,
      `4c. CAT EXPIRY: ${d.categoryExpiry}`,
      `5.  CARD SERIAL:${d.cardSerial}`,
      ``,
      `DL NUMBER:      ${d.dlNumber} ${d.randomSuffix}`,
      ``,
      `AM/A:    ${d.amAIssue} → ${d.categoryExpiry}`,
      `B/B1/BE: ${d.bIssue} → ${d.categoryExpiry}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    this.copied.set('all');
    setTimeout(() => this.copied.set(null), 1500);
  }

  randomize() {
    const rnd = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const sex = Math.random() > 0.5 ? 'M' : 'F';
    const first = sex === 'M' ? rnd(FIRSTNAMES_M) : rnd(FIRSTNAMES_F);
    const middle = Math.random() > 0.4 ? rnd(sex === 'M' ? FIRSTNAMES_M : FIRSTNAMES_F) : '';
    const year = new Date().getFullYear() - Math.floor(Math.random() * 45 + 18);
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const dob = `${String(day).padStart(2,'0')}-${String(month).padStart(2,'0')}-${year}`;
    const suffix = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    const rev: '2015' | '2023' = Math.random() > 0.5 ? '2023' : '2015';
    const licenceType: 'standard' | 'group2' = Math.random() > 0.8 ? 'group2' : 'standard';
    this.selectedRevision.set(rev);
    this.euVariant.set(rev === '2015' && Math.random() > 0.5);
    this.fields.set({ surname: rnd(SURNAMES), firstname: first, middlename: middle, dob, sex, randomSuffix: suffix, licenceType });
    const dl = buildDlNumber(this.fields());
    this.result.set(dl);
    this.docData.set(buildDocData(this.fields(), dl, suffix, rev, this.euVariant()));
    this.pushHistory(dl, suffix);
  }

  clear() {
    this.fields.set({ surname: '', firstname: '', middlename: '', dob: '', sex: 'M', randomSuffix: '01', licenceType: 'standard' });
    this.result.set(null);
    this.docData.set(null);
  }
}
