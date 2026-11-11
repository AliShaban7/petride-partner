/**
 * Localised mock catalogue: partners, services, products, breeds, vaccines, name pools and the
 * text templates the mock API resolves per locale. Strings shared with the mobile app are copied
 * verbatim from its copy so both products say the same thing.
 */
import type {
  IsoWeekday,
  LocalizedText,
  OpeningHoursDay,
  PartnerKind,
  PetSize,
  ProductCategory,
  ServiceCategory,
  Species,
} from "../types";

type L = LocalizedText;
const l = (az: string, ru: string, en: string): L => ({ az, ru, en });

// ---- Partners --------------------------------------------------------------------------------------

export const PARTNER_IDS = { idea: "idea", shop: "pawpaw" } as const;
export type DemoPartnerId = (typeof PARTNER_IDS)[keyof typeof PARTNER_IDS];

export type PartnerSeed = {
  id: string;
  kind: PartnerKind;
  name: string;
  shortName: string;
  title: L;
  categories: ServiceCategory[];
  address: L;
  area: L;
  phone: string;
  email: string;
  lat: number;
  lng: number;
  hours: OpeningHoursDay[];
  hoursConfirmed: boolean;
  acceptsRides: boolean;
  offersCourierDelivery: boolean;
  autoConfirm: boolean;
  responseWindowMin: number;
  isDemo: boolean;
  /** Road distance from central Baku, km (ride prices / durations). */
  distanceKm: number;
};

const hours = (weekday: [string, string], saturday: [string, string] | null, sunday: [string, string] | null) =>
  ([1, 2, 3, 4, 5, 6, 7] as IsoWeekday[]).map((day): OpeningHoursDay => {
    const span = day <= 5 ? weekday : day === 6 ? saturday : sunday;
    return span ? { day, open: true, from: span[0], to: span[1] } : { day, open: false, from: "10:00", to: "18:00" };
  });

export const PARTNERS: Record<DemoPartnerId, PartnerSeed> = {
  idea: {
    id: PARTNER_IDS.idea,
    kind: "clinic",
    // Same facts as the mobile app. Hours are NOT known — editable defaults
    // with hoursConfirmed: false; the partner sets the real ones in Settings.
    name: "IDEA Animal Care Center",
    shortName: "IDEA",
    title: l("IDEA · Baytar klinikası", "IDEA · Ветклиника", "IDEA · Vet clinic"),
    categories: ["vet", "groom", "hotel"],
    address: l("Qaradağ, Salyan şossesi 19 km", "Гарадаг, Сальянское шоссе, 19 км", "Garadagh, Salyan Hwy 19 km"),
    area: l("Qaradağ · ~22 km", "Гарадаг · ~22 км", "Garadagh · ~22 km"),
    phone: "+994125656655",
    email: "idea@petride.az",
    lat: 40.289,
    lng: 49.7085,
    hours: hours(["09:00", "19:00"], ["10:00", "18:00"], ["10:00", "16:00"]),
    hoursConfirmed: false,
    acceptsRides: true,
    offersCourierDelivery: false,
    autoConfirm: false,
    responseWindowMin: 30,
    isDemo: false,
    distanceKm: 22,
  },
  pawpaw: {
    id: PARTNER_IDS.shop,
    kind: "petshop",
    // Demo partner — not a real business.
    name: "PawPaw Pet Shop",
    shortName: "PawPaw",
    title: l("PawPaw · Zoomağaza", "PawPaw · Зоомагазин", "PawPaw · Pet shop"),
    categories: ["shop"],
    address: l("Nərimanov, Təbriz küç. 51 (demo)", "Нариманов, ул. Тебриз 51 (демо)", "Narimanov, 51 Tabriz St (demo)"),
    area: l("Nərimanov · ~4 km", "Нариманов · ~4 км", "Narimanov · ~4 km"),
    phone: "+994120000000",
    email: "shop@petride.az",
    lat: 40.4093,
    lng: 49.8671,
    hours: hours(["09:00", "21:00"], ["10:00", "21:00"], ["10:00", "18:00"]),
    hoursConfirmed: true,
    acceptsRides: false,
    offersCourierDelivery: true,
    autoConfirm: true,
    responseWindowMin: 15,
    isDemo: true,
    distanceKm: 4,
  },
};

// ---- Services (IDEA: the app's six offerings, same names) -------------------------------------------

export type ServiceSeed = {
  id: string;
  category: Exclude<ServiceCategory, "shop">;
  name: L;
  description: L;
  durationMin: number;
  /** DEMO list prices — IDEA's real prices are unknown; the partner sets them on the Services page. */
  priceAZN: number | null;
  priceFrom: boolean;
  species: Species[];
  /** Relative demand weight within the category. */
  weight: number;
};

export const IDEA_SERVICES: ServiceSeed[] = [
  {
    id: "off-vet-check",
    category: "vet",
    name: l("Ümumi müayinə", "Общий осмотр", "General check-up"),
    description: l("İt və pişik · ~30 dəq", "Собаки и кошки · ~30 мин", "Dogs and cats · ~30 min"),
    durationMin: 30,
    priceAZN: 30,
    priceFrom: false,
    species: ["dog", "cat", "other"],
    weight: 6,
  },
  {
    id: "off-vet-vaccine",
    category: "vet",
    name: l("Peyvənd", "Вакцинация", "Vaccination"),
    description: l("Müayinə ilə · ~20 dəq", "С осмотром · ~20 мин", "Includes a check · ~20 min"),
    durationMin: 20,
    priceAZN: 35,
    priceFrom: true,
    species: ["dog", "cat"],
    weight: 4,
  },
  {
    id: "off-groom-full",
    category: "groom",
    name: l("Tam qrooming", "Полный груминг", "Full grooming"),
    description: l("Böyük it · ~2 saat", "Крупная собака · ~2 часа", "Large dog · ~2 hours"),
    durationMin: 120,
    priceAZN: 70,
    priceFrom: true,
    species: ["dog", "cat"],
    weight: 3,
  },
  {
    id: "off-groom-wash",
    category: "groom",
    name: l("Yuyunma və daraqlama", "Мытьё и вычёсывание", "Bath and brush"),
    description: l("Bütün ölçülər · ~1 saat", "Любой размер · ~1 час", "Any size · ~1 hour"),
    durationMin: 60,
    priceAZN: 40,
    priceFrom: true,
    species: ["dog", "cat"],
    weight: 4,
  },
  {
    id: "off-hotel-night",
    category: "hotel",
    name: l("Gecələmə", "Проживание", "Overnight stay"),
    description: l("Bütün ölçülər · 1 gecə", "Любой размер · 1 ночь", "Any size · 1 night"),
    durationMin: 1440,
    priceAZN: 30,
    priceFrom: false,
    species: ["dog", "cat"],
    weight: 2,
  },
  {
    id: "off-hotel-day",
    category: "hotel",
    name: l("Gündüz baxımı", "Дневной присмотр", "Day care"),
    description: l("Bütün ölçülər · ~8 saat", "Любой размер · ~8 часов", "Any size · ~8 hours"),
    durationMin: 480,
    // Not priced yet: the app keeps showing "Priced on site" until the partner sets it.
    priceAZN: null,
    priceFrom: false,
    species: ["dog", "cat"],
    weight: 1,
  },
];

// ---- Products (demo pet shop; generic names, no brands) --------------------------------------------

export type ProductSeed = {
  id: string;
  category: ProductCategory;
  name: L;
  species: Species[];
  priceAZN: number;
  weight: number;
};

export const SHOP_PRODUCTS: ProductSeed[] = [
  { id: "p-dog-dry-3", category: "food", name: l("Quru it yemi, yetkin · 3 kq", "Сухой корм для собак, взрослых · 3 кг", "Dry dog food, adult · 3 kg"), species: ["dog"], priceAZN: 24.9, weight: 9 },
  { id: "p-dog-dry-12", category: "food", name: l("Quru it yemi, böyük cinslər · 12 kq", "Сухой корм для крупных пород · 12 кг", "Dry dog food, large breeds · 12 kg"), species: ["dog"], priceAZN: 79, weight: 5 },
  { id: "p-puppy-dry", category: "food", name: l("Küçük yemi · 2 kq", "Корм для щенков · 2 кг", "Puppy food · 2 kg"), species: ["dog"], priceAZN: 21.5, weight: 4 },
  { id: "p-dog-wet", category: "food", name: l("Yaş it yemi, toyuqlu · 400 q", "Влажный корм для собак, курица · 400 г", "Wet dog food, chicken · 400 g"), species: ["dog"], priceAZN: 3.6, weight: 8 },
  { id: "p-cat-dry-2", category: "food", name: l("Quru pişik yemi · 2 kq", "Сухой корм для кошек · 2 кг", "Dry cat food · 2 kg"), species: ["cat"], priceAZN: 19.9, weight: 10 },
  { id: "p-cat-sterile", category: "food", name: l("Sterilizə olunmuş pişiklər üçün yem · 1,5 kq", "Корм для стерилизованных кошек · 1,5 кг", "Food for neutered cats · 1.5 kg"), species: ["cat"], priceAZN: 22.4, weight: 6 },
  { id: "p-cat-wet", category: "food", name: l("Yaş pişik yemi, balıqlı · 85 q", "Влажный корм для кошек, рыба · 85 г", "Wet cat food, fish · 85 g"), species: ["cat"], priceAZN: 1.4, weight: 12 },
  { id: "p-kitten", category: "food", name: l("Bala pişik yemi · 1 kq", "Корм для котят · 1 кг", "Kitten food · 1 kg"), species: ["cat"], priceAZN: 14.8, weight: 4 },
  { id: "p-treat-dog", category: "treats", name: l("Diş üçün çeynəmə çubuqları · 7 əd.", "Жевательные палочки для зубов · 7 шт.", "Dental chew sticks · 7 pcs"), species: ["dog"], priceAZN: 6.5, weight: 7 },
  { id: "p-treat-cat", category: "treats", name: l("Pişik ləzzəti, krem · 4 əd.", "Лакомство-крем для кошек · 4 шт.", "Creamy cat treats · 4 pcs"), species: ["cat"], priceAZN: 4.2, weight: 8 },
  { id: "p-treat-train", category: "treats", name: l("Təlim üçün mükafat · 150 q", "Лакомства для дрессировки · 150 г", "Training treats · 150 g"), species: ["dog"], priceAZN: 5.9, weight: 4 },
  { id: "p-toy-rope", category: "toys", name: l("İp oyuncaq", "Игрушка-канат", "Rope toy"), species: ["dog"], priceAZN: 7.5, weight: 4 },
  { id: "p-toy-ball", category: "toys", name: l("Rezin top", "Резиновый мяч", "Rubber ball"), species: ["dog"], priceAZN: 4.9, weight: 5 },
  { id: "p-toy-wand", category: "toys", name: l("Lələkli oyun çubuğu", "Удочка-дразнилка с перьями", "Feather wand"), species: ["cat"], priceAZN: 6.2, weight: 5 },
  { id: "p-scratcher", category: "accessories", name: l("Cırmaqlıq, karton", "Когтеточка, картон", "Cardboard scratcher"), species: ["cat"], priceAZN: 12.9, weight: 4 },
  { id: "p-litter", category: "care", name: l("Topaqlanan qum · 10 l", "Комкующийся наполнитель · 10 л", "Clumping litter · 10 L"), species: ["cat"], priceAZN: 11.5, weight: 9 },
  { id: "p-shampoo", category: "care", name: l("Həssas dəri üçün şampun", "Шампунь для чувствительной кожи", "Sensitive-skin shampoo"), species: ["dog", "cat"], priceAZN: 13.4, weight: 3 },
  { id: "p-brush", category: "care", name: l("Yumşaq daraq", "Мягкая щётка-пуходёрка", "Soft slicker brush"), species: ["dog", "cat"], priceAZN: 9.8, weight: 3 },
  { id: "p-leash", category: "accessories", name: l("Qayış, 2 m", "Поводок, 2 м", "Leash, 2 m"), species: ["dog"], priceAZN: 15, weight: 3 },
  { id: "p-harness", category: "accessories", name: l("Sinəbənd, M", "Шлейка, M", "Harness, M"), species: ["dog"], priceAZN: 24, weight: 2 },
  { id: "p-carrier", category: "accessories", name: l("Daşıma qutusu", "Переноска", "Pet carrier"), species: ["cat", "dog"], priceAZN: 45, weight: 2 },
  { id: "p-bowl", category: "accessories", name: l("Paslanmayan qab", "Миска из нержавеющей стали", "Stainless steel bowl"), species: ["dog", "cat"], priceAZN: 6.9, weight: 3 },
  { id: "p-flea", category: "health", name: l("Birə və gənəyə qarşı damcı", "Капли от блох и клещей", "Flea and tick drops"), species: ["dog", "cat"], priceAZN: 18.5, weight: 5 },
  { id: "p-omega", category: "health", name: l("Omeqa-3 əlavəsi", "Омега-3", "Omega-3 supplement"), species: ["dog", "cat"], priceAZN: 16.9, weight: 2 },
];

// ---- Pets ------------------------------------------------------------------------------------------

export type BreedSeed = { name: L; species: Species; size: PetSize; weightKg: [number, number]; weight: number };

export const BREEDS: BreedSeed[] = [
  { name: l("Golden Retriever", "Голден ретривер", "Golden Retriever"), species: "dog", size: "large", weightKg: [25, 34], weight: 4 },
  { name: l("Labrador Retriever", "Лабрадор-ретривер", "Labrador Retriever"), species: "dog", size: "large", weightKg: [26, 36], weight: 4 },
  { name: l("Alman çoban iti", "Немецкая овчарка", "German Shepherd"), species: "dog", size: "large", weightKg: [28, 40], weight: 3 },
  { name: l("Qafqaz çoban iti", "Кавказская овчарка", "Caucasian Shepherd"), species: "dog", size: "large", weightKg: [45, 65], weight: 1 },
  { name: l("Hasky", "Хаски", "Husky"), species: "dog", size: "medium", weightKg: [18, 27], weight: 2 },
  { name: l("Bigl", "Бигль", "Beagle"), species: "dog", size: "medium", weightKg: [9, 14], weight: 2 },
  { name: l("Velş-korgi", "Вельш-корги", "Welsh Corgi"), species: "dog", size: "medium", weightKg: [10, 14], weight: 2 },
  { name: l("Fransız buldoqu", "Французский бульдог", "French Bulldog"), species: "dog", size: "small", weightKg: [8, 13], weight: 3 },
  { name: l("Pomeranian şpits", "Померанский шпиц", "Pomeranian"), species: "dog", size: "small", weightKg: [2, 3.5], weight: 4 },
  { name: l("Yorkşir teryeri", "Йоркширский терьер", "Yorkshire Terrier"), species: "dog", size: "small", weightKg: [2, 3.2], weight: 4 },
  { name: l("Şi-tsu", "Ши-тцу", "Shih Tzu"), species: "dog", size: "small", weightKg: [4, 7.5], weight: 3 },
  { name: l("Pudel", "Пудель", "Poodle"), species: "dog", size: "medium", weightKg: [5, 22], weight: 2 },
  { name: l("Çihuahua", "Чихуахуа", "Chihuahua"), species: "dog", size: "small", weightKg: [1.5, 3], weight: 2 },
  { name: l("Malta bolonkası", "Мальтийская болонка", "Maltese"), species: "dog", size: "small", weightKg: [2, 4], weight: 2 },
  { name: l("Metis", "Метис", "Mixed breed"), species: "dog", size: "medium", weightKg: [8, 25], weight: 4 },
  { name: l("zolaqlı (tabby)", "полосатый (табби)", "tabby"), species: "cat", size: "small", weightKg: [3, 5.5], weight: 4 },
  { name: l("Britaniya qısatüklü", "Британская короткошёрстная", "British Shorthair"), species: "cat", size: "small", weightKg: [3.5, 7], weight: 5 },
  { name: l("Şotland qatlaqqulaq", "Шотландская вислоухая", "Scottish Fold"), species: "cat", size: "small", weightKg: [3, 6], weight: 4 },
  { name: l("Fars pişiyi", "Персидская", "Persian"), species: "cat", size: "small", weightKg: [3, 5.5], weight: 3 },
  { name: l("Men-kun", "Мейн-кун", "Maine Coon"), species: "cat", size: "medium", weightKg: [5, 9], weight: 2 },
  { name: l("Sfinks", "Сфинкс", "Sphynx"), species: "cat", size: "small", weightKg: [3, 5], weight: 1 },
  { name: l("Sibir pişiyi", "Сибирская", "Siberian"), species: "cat", size: "small", weightKg: [4, 8], weight: 2 },
  { name: l("Ev pişiyi", "Домашняя кошка", "Domestic shorthair"), species: "cat", size: "small", weightKg: [3, 6], weight: 6 },
  { name: l("Dekorativ dovşan", "Декоративный кролик", "Pet rabbit"), species: "other", size: "small", weightKg: [1.2, 2.5], weight: 2 },
  { name: l("Dalğalı tutuquşu", "Волнистый попугай", "Budgerigar"), species: "other", size: "small", weightKg: [0.03, 0.04], weight: 1 },
];

export const PET_NAMES = {
  dog: ["Max", "Rex", "Leo", "Lucky", "Çarli", "Simba", "Toffi", "Roki", "Archi", "Mars", "Jack", "Daisy", "Luna", "Ruby", "Milo", "Oscar", "Bonya", "Cessi", "Karamel", "Zeus", "Bobik", "Fındıq"],
  cat: ["Mırmır", "Pişi", "Tom", "Luna", "Mia", "Cleo", "Zara", "Murka", "Barsik", "Pusi", "Ağca", "Qaraca", "Tiger", "Lotus", "Bulka", "Simba", "Nala", "Oliver", "Leo", "Şaftalı"],
  other: ["Kiwi", "Bunny", "Pambıq", "Çiko"],
  dogRu: ["Шарик", "Джек", "Граф", "Тиша", "Бусинка", "Ричи", "Боня", "Лаки"],
  catRu: ["Барсик", "Мурка", "Пушок", "Рыжик", "Тимоша", "Василиса", "Маркиз", "Соня"],
} as const;

export const TRAVEL_NOTES: L[] = [
  l("Maşında narahat olur", "Нервничает в машине", "Anxious in cars"),
  l("Daşıma qutusu", "Переноска", "Needs a carrier"),
  l("Heyvanlardan çəkinir", "Сторонится животных", "Wary of other pets"),
  l("Maşında ürəyi bulanır", "Укачивает в машине", "Gets car-sick"),
  l("Qayışla gəlir", "На поводке", "On a leash"),
  l("Yaşlıdır, ehtiyatla", "Пожилой, осторожно", "Senior, handle gently"),
];

export const PARTNER_PET_NOTES: L[] = [
  l("Toyuğa allergiyası var", "Аллергия на курицу", "Allergic to chicken"),
  l("Müayinədə əsəbiləşir — ağızlıq lazım ola bilər", "Нервничает на осмотре — может понадобиться намордник", "Gets stressed at check-ups — may need a muzzle"),
  l("Dırnaq kəsiminə dözmür", "Плохо переносит стрижку когтей", "Doesn't tolerate nail trims"),
  l("Ürək çatışmazlığı, narkozdan əvvəl kardioloq", "Сердечная недостаточность, перед наркозом — кардиолог", "Heart condition — cardiology check before anaesthesia"),
];

export const VACCINES = {
  rabies: l("Quduzluq", "Бешенство", "Rabies"),
  lepto: l("Leptospiroz", "Лептоспироз", "Leptospirosis"),
  dhppi: l("Kompleks (DHPPi)", "Комплексная (DHPPi)", "Combo (DHPPi)"),
  parasite: l("Parazitlərə qarşı", "От паразитов", "Parasite control"),
  fvrcp: l("Kompleks (FVRCP)", "Комплексная (FVRCP)", "Combo (FVRCP)"),
};

// ---- People ----------------------------------------------------------------------------------------

export const AZ_NAMES = {
  female: ["Aysel", "Nigar", "Günel", "Səbinə", "Aynur", "Lalə", "Nərmin", "Fidan", "Zəhra", "Kamilla", "Aytən", "Ülviyyə", "Röya", "Xədicə", "Nurlana", "Mələk", "Arzu", "Vüsalə", "Səidə", "Türkan", "Aidə", "Ləman"],
  male: ["Elvin", "Rəşad", "Tural", "Orxan", "Kənan", "Fərid", "Murad", "Nicat", "Ramin", "Samir", "Emin", "Əli", "Cavid", "Rüfət", "Elnur", "Vüqar", "Toğrul", "İlkin", "Şahin", "Kamran", "Fuad", "Ruslan"],
  surnames: ["Məmmədov", "Əliyev", "Hüseynov", "Həsənov", "Quliyev", "Abbasov", "İsmayılov", "Rzayev", "Nəsirov", "Kərimov", "Babayev", "Səfərov", "Mustafayev", "Cəfərov", "Orucov", "Ağayev", "Zeynalov", "Qasımov", "Nağıyev", "Bayramov", "Əhmədov", "Sultanov"],
};

export const RU_NAMES = {
  female: ["Ольга", "Анна", "Екатерина", "Наталья", "Мария", "Ирина", "Татьяна", "Светлана", "Юлия", "Алина"],
  male: ["Дмитрий", "Алексей", "Сергей", "Андрей", "Игорь", "Максим", "Павел", "Николай"],
  surnames: ["Иванов", "Петров", "Смирнов", "Кузнецов", "Попов", "Соколов", "Лебедев", "Новиков", "Морозов", "Волков"],
};

export const AREAS: L[] = [
  l("Nəsimi, Bakı", "Насими, Баку", "Nasimi, Baku"),
  l("Yasamal, Bakı", "Ясамал, Баку", "Yasamal, Baku"),
  l("Nərimanov, Bakı", "Нариманов, Баку", "Narimanov, Baku"),
  l("Xətai, Bakı", "Хатаи, Баку", "Khatai, Baku"),
  l("Səbail, Bakı", "Сабаил, Баку", "Sabail, Baku"),
  l("Binəqədi, Bakı", "Бинагади, Баку", "Binagadi, Baku"),
  l("Nizami, Bakı", "Низами, Баку", "Nizami, Baku"),
  l("Qaradağ, Bakı", "Гарадаг, Баку", "Garadagh, Baku"),
  l("Abşeron", "Абшерон", "Absheron"),
  l("Sumqayıt", "Сумгаит", "Sumgait"),
];

export const STREETS = [
  "Nizami küç.", "Füzuli küç.", "Azadlıq pr.", "Bakıxanov küç.", "Səməd Vurğun küç.", "Rəşid Behbudov küç.",
  "Təbriz küç.", "Atatürk pr.", "Həsən bəy Zərdabi pr.", "Xətai pr.", "Zərifə Əliyeva küç.", "Şərifzadə küç.",
];

// ---- Drivers (Anar is the app's driver; phone numbers are deliberately fake) -------------------------

export type DriverSeed = {
  id: string;
  name: L;
  rating: number;
  phone: string;
  car: { model: string; color: L; plate: string };
};

const white = l("ağ", "белая", "white");
export const DRIVERS: DriverSeed[] = [
  { id: "driver-anar", name: l("Anar Həsənov", "Анар Гасанов", "Anar Hasanov"), rating: 4.9, phone: "+994500000001", car: { model: "Toyota Prius", color: white, plate: "10-AA-123" } },
  { id: "driver-rashad", name: l("Rəşad Quliyev", "Рашад Кулиев", "Rashad Guliyev"), rating: 4.8, phone: "+994500000002", car: { model: "Hyundai Elantra", color: l("gümüşü", "серебристая", "silver"), plate: "90-RB-417" } },
  { id: "driver-elvin", name: l("Elvin Məmmədov", "Эльвин Мамедов", "Elvin Mammadov"), rating: 4.9, phone: "+994500000003", car: { model: "Kia Rio", color: white, plate: "77-KE-205" } },
  { id: "driver-tural", name: l("Tural Əliyev", "Турал Алиев", "Tural Aliyev"), rating: 4.7, phone: "+994500000004", car: { model: "Toyota Corolla", color: l("qara", "чёрная", "black"), plate: "10-TA-588" } },
  { id: "driver-kamran", name: l("Kamran Hüseynov", "Камран Гусейнов", "Kamran Huseynov"), rating: 4.8, phone: "+994500000005", car: { model: "Chevrolet Cobalt", color: l("göy", "синяя", "blue"), plate: "99-KH-310" } },
  { id: "driver-orkhan", name: l("Orxan Səfərov", "Орхан Сафаров", "Orkhan Safarov"), rating: 5.0, phone: "+994500000006", car: { model: "Toyota Prius", color: white, plate: "10-OS-742" } },
];

// ---- Text pools ------------------------------------------------------------------------------------

export const CLIENT_NOTES: L[] = [
  l("Zəhmət olmasa, gəlməmişdən əvvəl zəng edin.", "Пожалуйста, позвоните перед приездом.", "Please call before the visit."),
  l("Son vaxtlar iştahı azdır.", "В последнее время плохой аппетит.", "Hasn't been eating much lately."),
  l("Qısa kəsim istəyirik, quyruğu toxunmayın.", "Хотим короткую стрижку, хвост не трогать.", "Short cut please, leave the tail."),
  l("İlk dəfə gəlirik, bir az qorxaqdır.", "Мы впервые, немного боится.", "First visit — a bit shy."),
  l("Qulağını tez-tez qaşıyır.", "Часто чешет ухо.", "Keeps scratching an ear."),
];

export const DECLINE_REASONS: L[] = [
  l("Bu saatda yer yoxdur — başqa vaxt seç.", "На это время нет мест — выбери другое.", "No free slot at that time — pick another."),
  l("Bu xidmət hələ bu heyvan növü üçün yoxdur.", "Эта услуга пока не для этого вида животных.", "We don't offer this for that species yet."),
];

export const CANCEL_REASONS: L[] = [
  l("Müştəri planlarını dəyişdi.", "Клиент изменил планы.", "The client changed plans."),
  l("Heyvan xəstələndi, sonra yazılacaq.", "Питомец заболел, запишутся позже.", "The pet fell ill — they'll rebook."),
  l("Həkim xəstədir, vaxt dəyişdirildi.", "Врач заболел, время переносим.", "The vet is off sick — rescheduling."),
];

/** Review texts are user data: written in the client's own language. */
export const REVIEW_TEXTS: Record<"az" | "ru", Record<"great" | "ok" | "bad", string[]>> = {
  az: {
    great: [
      "Həkimlər çox diqqətlidir, balaca dostumuz heç qorxmadı. Sağ olun!",
      "Qrooming əla alındı, pişiyimiz tanınmaz oldu :)",
      "PetRide ilə gətirib-apardılar, mən işdən ayrılmadım. Çox rahat.",
      "Səliqəli, təmiz, heyvanlara mehriban münasibət.",
      "Peyvəndi tez və ağrısız etdilər, hər şeyi izah etdilər.",
    ],
    ok: ["Hər şey yaxşı idi, amma bir az gözlədik.", "Xidmət yaxşıdır, qiymətlər bir az bahadır."],
    bad: ["Növbə çox uzun idi, vaxtında qəbul etmədilər."],
  },
  ru: {
    great: [
      "Очень внимательные врачи, всё подробно объяснили. Спасибо!",
      "Груминг супер, наш шпиц как с выставки.",
      "Удобно, что PetRide привёз и отвёз — не пришлось отпрашиваться с работы.",
      "Чисто, спокойно, к животным относятся с любовью.",
    ],
    ok: ["В целом хорошо, но пришлось подождать минут 20.", "Нормально, но хотелось бы запись на выходные."],
    bad: ["Перенесли запись в последний момент, неприятно."],
  },
};

export const REVIEW_REPLIES: L[] = [
  l("Təşəkkür edirik! Sizi yenə gözləyirik.", "Спасибо! Ждём вас снова.", "Thank you! See you next time."),
  l("Rəyiniz üçün sağ olun, gözləmə müddətini azaltmağa çalışırıq.", "Спасибо за отзыв, работаем над временем ожидания.", "Thanks for the feedback — we're working on wait times."),
];

// ---- Ride places -----------------------------------------------------------------------------------

export const HOME_LABEL = l("Ev", "Дом", "Home");

// ---- Notification templates (resolved per locale with {{vars}}) -------------------------------------

export const NOTIFICATION_TEXT = {
  new_request: {
    title: l("Yeni sorğu", "Новая заявка", "New request"),
    body: l("{{client}} · {{pet}} · {{service}}, {{when}}", "{{client}} · {{pet}} · {{service}}, {{when}}", "{{client}} · {{pet}} · {{service}}, {{when}}"),
  },
  request_cancelled: {
    title: l("Sorğu ləğv edildi", "Заявка отменена", "Booking cancelled"),
    body: l("{{client}} {{pet}} üçün {{when}} vaxtını ləğv etdi.", "{{client}} отменил(а) запись {{pet}} на {{when}}.", "{{client}} cancelled {{pet}}'s booking for {{when}}."),
  },
  ride_onway: {
    title: l("Sürücü yoldadır", "Водитель в пути", "Driver on the way"),
    body: l("{{driver}} yola çıxıb: {{pet}} üçün gəlir.", "{{driver}} выехал за {{pet}}.", "{{driver}} is heading to pick up {{pet}}."),
  },
  ride_arriving: {
    title: l("{{pet}} yoldadır", "{{pet}} в пути", "{{pet}} is on the way"),
    body: l("{{driver}} ~{{eta}} dəqiqəyə çatır.", "{{driver}} будет через ~{{eta}} мин.", "{{driver}} arrives in ~{{eta}} min."),
  },
  ride_arrived: {
    title: l("{{pet}} gəldi", "{{pet}} приехал(а)", "{{pet}} has arrived"),
    body: l("{{driver}} qapıdadır.", "{{driver}} у входа.", "{{driver}} is at the door."),
  },
  new_order: {
    title: l("Yeni sifariş {{code}}", "Новый заказ {{code}}", "New order {{code}}"),
    body: l("{{client}} · {{items}} məhsul · {{total}}", "{{client}} · товаров: {{items}} · {{total}}", "{{client}} · {{total}}"),
  },
  order_cancelled: {
    title: l("Sifariş ləğv edildi {{code}}", "Заказ отменён {{code}}", "Order cancelled {{code}}"),
    body: l("{{client}} sifarişi ləğv etdi.", "{{client}} отменил(а) заказ.", "{{client}} cancelled the order."),
  },
  new_review: {
    title: l("Yeni rəy · {{rating}}★", "Новый отзыв · {{rating}}★", "New review · {{rating}}★"),
    body: l("{{client}}: “{{text}}”", "{{client}}: «{{text}}»", "{{client}}: “{{text}}”"),
  },
  vaccine_due: {
    title: l("Peyvənd vaxtı", "Пора на прививку", "Vaccine due"),
    body: l("{{pet}} · {{vaccine}} — son tarix {{date}}.", "{{pet}} · {{vaccine}} — срок {{date}}.", "{{pet}} · {{vaccine}} — due {{date}}."),
  },
} satisfies Record<string, { title: L; body: L }>;
