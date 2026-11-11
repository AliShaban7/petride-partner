import { formatNumber } from "@/lib/format";

import { INTL_LOCALE, type Locale } from "./config";
import type { Messages, Namespace, Translator, Vars } from "./types";

const pluralRules = new Map<Locale, Intl.PluralRules>();
function rulesFor(locale: Locale): Intl.PluralRules {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(INTL_LOCALE[locale]);
    pluralRules.set(locale, rules);
  }
  return rules;
}

function lookup(tree: unknown, key: string): string | undefined {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Builds a typed `t()` for one namespace. Shared by the server (`getT`) and the client (`useT`). */
export function createTranslator<NS extends Namespace>(
  locale: Locale,
  messages: Messages,
  namespace: NS,
): Translator<NS> {
  const tree = messages[namespace];
  const missing = (key: string) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] Missing message "${namespace}.${key}" for "${locale}"`);
    }
    return key;
  };

  const dynamic = (key: string, vars?: Vars) => {
    const template = lookup(tree, key);
    return template === undefined ? missing(key) : interpolate(template, vars);
  };

  const t = ((key: string, vars?: Vars) => dynamic(key, vars)) as unknown as Translator<NS>;
  t.dynamic = dynamic;
  t.has = (key: string) => lookup(tree, key) !== undefined;
  t.plural = (key: string, count: number, vars?: Vars) => {
    const form = rulesFor(locale).select(count);
    const template = lookup(tree, `${key}_${form}`) ?? lookup(tree, `${key}_other`);
    if (template === undefined) return missing(`${key}_${form}`);
    return interpolate(template, { count: formatNumber(count, locale), ...vars });
  };
  return t;
}
