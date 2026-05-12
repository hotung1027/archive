import type { Card } from '@omnisearch/types';

export interface ApiCard {
  slug: string;
  uuid: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  language: string;
  releaseDate: string | null;
  rarity: string;
  elements: string;   // JSON string from DB
  classes: string;    // JSON string from DB
  type: string;
  subtypes: string;   // JSON string from DB
  reserveCost: number | null;
  memoryCost: number | null;
  level: number | null;
  life: number | null;
  power: number | null;
  durability: number | null;
  effectText: string | null;
  flavorText: string | null;
  imageUrl: string;
  illustrator: string | null;
  cardJson: string;
  editionJson: string;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function parseDbCard(row: ApiCard): Card {
  return {
    uuid:            row.uuid,
    name:            row.name,
    slug:            row.slug,
    release: {
      setCode:          row.setCode,
      setName:          row.setName,
      collectorNumber:  row.collectorNumber,
      language:         row.language,
      releaseDate:      row.releaseDate,
    },
    elements:        parseJsonArray(row.elements),
    classes:         parseJsonArray(row.classes),
    type:            row.type,
    subtypes:        parseJsonArray(row.subtypes),
    reserveCost:     row.reserveCost,
    memoryCost:      row.memoryCost,
    level:           row.level,
    life:            row.life,
    power:           row.power,
    durability:      row.durability,
    effectText:      row.effectText,
    flavorText:      row.flavorText,
    imageUrl:        row.imageUrl,
    illustrator:     row.illustrator,
    rarity:          row.rarity,
    raw: {
      card: parseJsonRecord(row.cardJson),
      edition: parseJsonRecord(row.editionJson),
    },
  };
}
