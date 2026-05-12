'use client';

import { useFilterStore } from '@/store/filterStore';
import { useState, type ReactNode } from 'react';
import type { FilterOperator } from '@omnisearch/types';

const ELEMENTS = ['Arcane', 'Astra', 'Crux', 'Exalted', 'Exia', 'Fire', 'Luxem', 'Neos', 'Norm', 'Tera', 'Umbra', 'Water', 'Wind'];
const CARD_TYPES = ['Action', 'Ally', 'Attack', 'Champion', 'Domain', 'Greater Boon', 'Item', 'Lesser Boon', 'Mastery', 'Phantasia', 'Regalia', 'Status', 'Token', 'Unique', 'Weapon'];
const CLASSES = ['Anomaly', 'Assassin', 'Cleric', 'Guardian', 'Mage', 'Ranger', 'Spirit', 'Tamer', 'Warrior'];
const _ALL_SUBTYPES = ['Accessory','Adjuvant','Aethercharge','Aetherwing','Angel','Animal','Anomaly','Antelope','Ape','Apparition','Armor','Arrow','Artifact','Assassin','Automaton','Avatar','Axe','Barrier','Bauble','Bear','Beast','Bird','Bishop','Boar','Book','Boots','Bow','Bull','Bullet','Castle','Cat','Cataclysm','Catalyst','Chessman','Cleric','Cloak','Command','Component','Construct','Craft','Crossroads','Crystal','Curse','Dagger','Deer','Device','Distortion','Dog','Dragon','Dryad','Elemental','Factory','Fairy','Fan','Farm','Fatebound','Fatestone','Fish','Fist','Flower','Flowerbud','Flute','Food','Fox','Fractal','Frog','Gate','Gloves','Golem','Guardian','Gun','Hammer','Harmony','Herb','Horse','Human','Instrument','Isle','King','Kingdom','Knight','Lash','Leaf','Lion','Lizard','Mage','Map','Market','Maul','Melody','Memorite','Monkey','Mouse','Mushroom','Obelisk','Ocean','Party','Pawn','Phoenix','Polearm','Potion','Powercell','Queen','Rabbit','Raccoon','Ranger','Reaction','Rhino','Ring','River','Robe','Rook','Root','Ruins','Scepter','Scripture','Selkie','Serpent','Shadow','Shard','Sheep','Shield','Siegeable','Skill','Slime','Solvent','Specter','Spell','Spire','Spirit','Squirrel','Staff','Suited','Sword','Tamer','Throne','Tiger','Trial','Turtle','Ultimate','Unicorn','Wand','Warrior','Weasel','Whip','Wolf'];
const CARD_SUBTYPES = _ALL_SUBTYPES.filter(subtype => !CARD_TYPES.includes(subtype) && !CLASSES.includes(subtype));

interface Props {
  onFilterChange?: () => void;
}

type IncludeField = 'elements' | 'classes' | 'type' | 'subtypes';
type DragChip = { field: IncludeField; value: string };

function nextValues(values: string[], value: string) {
  return values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value];
}

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.trim().toLowerCase());
}

function FilterPanel({
  title,
  totalCount,
  activeCount,
  searchValue,
  onSearchChange,
  className,
  children,
}: {
  title: string;
  totalCount: number;
  activeCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <section className={`shrink-0 rounded border border-gray-800 bg-gray-950/60 ${className}`}>
      <div className="border-b border-gray-800 p-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-gray-300">{title}</h3>
          <span className="shrink-0 text-[10px] text-gray-600">
            {activeCount > 0 ? `${activeCount}/${totalCount}` : totalCount}
          </span>
        </div>
        <input
          className="h-7 w-full rounded border border-gray-800 bg-gray-900 px-2 text-xs text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
          placeholder={`Search ${title.toLowerCase()}...`}
          value={searchValue}
          onChange={event => onSearchChange(event.target.value)}
          aria-label={`Search ${title.toLowerCase()} filters`}
        />
      </div>
      <div className="max-h-44 overflow-y-auto p-1.5">
        {children}
      </div>
    </section>
  );
}

function IncludeFilterList({
  title,
  values,
  activeValues,
  searchValue,
  onSearchChange,
  onToggle,
  tone,
  className,
}: {
  title: string;
  values: string[];
  activeValues: string[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onToggle: (value: string) => void;
  tone: 'blue' | 'amber';
  className: string;
}) {
  const filteredValues = values.filter(value => matchesSearch(value, searchValue));
  const activeClasses = tone === 'blue'
    ? 'border-blue-600 bg-blue-900/50 text-white'
    : 'border-amber-600 bg-amber-900/50 text-white';
  const actionClasses = tone === 'blue'
    ? 'text-blue-300 group-hover:bg-blue-900/70 group-focus-within:bg-blue-900/70'
    : 'text-amber-300 group-hover:bg-amber-900/70 group-focus-within:bg-amber-900/70';

  return (
    <FilterPanel
      title={title}
      totalCount={values.length}
      activeCount={activeValues.length}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      className={className}
    >
      <div className="grid gap-1">
        {filteredValues.length === 0 ? (
          <p className="px-2 py-3 text-xs text-gray-600">No matches</p>
        ) : filteredValues.map(value => {
          const isActive = activeValues.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              aria-pressed={isActive}
              className={`group flex min-h-8 w-full items-center justify-between gap-2 rounded border px-2 text-left text-xs transition-colors ${
                isActive ? activeClasses : 'border-transparent text-gray-300 hover:border-gray-700 hover:bg-gray-900 hover:text-white'
              }`}
            >
              <span className="min-w-0 truncate">{value}</span>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded text-xs transition ${
                isActive ? 'bg-gray-950/40 text-white opacity-100' : `opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 ${actionClasses}`
              }`}>+</span>
            </button>
          );
        })}
      </div>
    </FilterPanel>
  );
}

function IncludeExcludeFilterList({
  title,
  values,
  activeValues,
  excludedValues,
  searchValue,
  onSearchChange,
  onInclude,
  onExclude,
  className,
}: {
  title: string;
  values: string[];
  activeValues: string[];
  excludedValues: string[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onInclude: (value: string) => void;
  onExclude: (value: string) => void;
  className: string;
}) {
  const filteredValues = values.filter(value => matchesSearch(value, searchValue));

  return (
    <FilterPanel
      title={title}
      totalCount={values.length}
      activeCount={activeValues.length + excludedValues.length}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      className={className}
    >
      <div className="grid gap-1">
        {filteredValues.length === 0 ? (
          <p className="px-2 py-3 text-xs text-gray-600">No matches</p>
        ) : filteredValues.map(value => {
          const isIncluded = activeValues.includes(value);
          const isExcluded = excludedValues.includes(value);
          const rowClass = isIncluded
            ? 'border-green-700 bg-green-950/50 text-white'
            : isExcluded
              ? 'border-red-700 bg-red-950/50 text-white'
              : 'border-transparent text-gray-300 hover:border-gray-700 hover:bg-gray-900 hover:text-white';
          const actionGroupVisibility = isIncluded || isExcluded
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';

          return (
            <div key={value} className={`group relative flex min-h-8 items-center rounded border px-2 text-xs transition-colors ${rowClass}`}>
              <span className={`min-w-0 flex-1 truncate ${isIncluded || isExcluded ? 'pr-14' : ''}`}>{value}</span>
              <div className={`absolute right-1.5 top-1 flex shrink-0 overflow-hidden rounded border border-gray-700 bg-gray-950/90 transition-opacity ${actionGroupVisibility}`}>
                <button
                  type="button"
                  onClick={() => onExclude(value)}
                  aria-label={`${isExcluded ? 'Remove exclude filter from' : 'Exclude'} ${value}`}
                  className={`grid h-6 w-7 place-items-center text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 ${
                    isExcluded ? 'text-red-300 hover:bg-red-950' : 'text-gray-500 hover:bg-red-900 hover:text-red-300'
                  }`}
                  title={isExcluded ? 'Remove exclude filter' : `Exclude ${value}`}
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => onInclude(value)}
                  aria-label={`${isIncluded ? 'Remove include filter from' : 'Include'} ${value}`}
                  className={`grid h-6 w-7 place-items-center border-l border-gray-700 text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-400 ${
                    isIncluded ? 'text-green-300 hover:bg-green-950' : 'text-gray-500 hover:bg-green-900 hover:text-green-300'
                  }`}
                  title={isIncluded ? 'Remove include filter' : `Include ${value}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </FilterPanel>
  );
}

export function FilterBar({ onFilterChange }: Props) {
  const {
    textSearch, setTextSearch,
    query,
    setAndRule, removeAndRule,
    addNotRule, removeNotRule,
    clearFilters,
  } = useFilterStore();

  const elementRule = query.and.find(rule => rule.field === 'elements');
  const classRule = query.and.find(rule => rule.field === 'classes');
  const typeRule = query.and.find(rule => rule.field === 'type');
  const costRule = query.and.find(rule => rule.field === 'reserveCost');
  const [costMin, setCostMin] = useState(costRule?.gte != null ? String(costRule.gte) : '');
  const [costMax, setCostMax] = useState(costRule?.lte != null ? String(costRule.lte) : '');
  const [dragChip, setDragChip] = useState<DragChip | null>(null);
  const [elementSearch, setElementSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [subtypeSearch, setSubtypeSearch] = useState('');

  const activeElements = elementRule?.values ?? [];
  const activeClasses = classRule?.values ?? [];
  const activeTypes = typeRule?.values ?? [];
  const notTypes = query.not.find(rule => rule.field === 'type')?.values ?? [];
  const subtypeRule = query.and.find(rule => rule.field === 'subtypes');
  const activeSubtypes = subtypeRule?.values ?? [];
  const notSubtypes = query.not.find(rule => rule.field === 'subtypes')?.values ?? [];

  function commit() {
    onFilterChange?.();
  }

  function setIncludeRule(field: IncludeField, values: string[], operator?: FilterOperator) {
    if (values.length === 0) {
      removeAndRule(field);
      return;
    }

    setAndRule({
      field,
      values,
      operator: values.length > 1 ? (operator ?? 'OR') : 'OR',
    });
  }

  function setNotTypes(values: string[]) {
    if (values.length === 0) removeNotRule('type');
    else addNotRule({ field: 'type', values });
  }

  function setNotSubtypes(values: string[]) {
    if (values.length === 0) removeNotRule('subtypes');
    else addNotRule({ field: 'subtypes', values });
  }

  function valuesForField(field: IncludeField) {
    if (field === 'elements') return activeElements;
    if (field === 'classes') return activeClasses;
    if (field === 'subtypes') return activeSubtypes;
    return activeTypes;
  }

  function setIncludeOperator(field: IncludeField, operator: FilterOperator) {
    const values = valuesForField(field);
    if (values.length === 0) return;
    setIncludeRule(field, values, operator);
    commit();
  }

  function handleIncludeChipDrop(targetField: IncludeField, targetValue: string) {
    if (!dragChip) return;
    const source = dragChip;
    setDragChip(null);

    if (source.field !== targetField || source.value === targetValue) return;

    const values = valuesForField(targetField);
    if (values.length > 1) {
      setIncludeRule(targetField, values, 'AND');
      commit();
    }
  }

  function toggleElement(element: string) {
    const values = nextValues(activeElements, element);
    setIncludeRule('elements', values, elementRule?.operator);
    commit();
  }

  function toggleClass(cardClass: string) {
    const values = nextValues(activeClasses, cardClass);
    setIncludeRule('classes', values, classRule?.operator);
    commit();
  }

  function toggleType(type: string) {
    const enablingType = !activeTypes.includes(type);
    const values = nextValues(activeTypes, type);
    setIncludeRule('type', values, typeRule?.operator);
    if (enablingType && notTypes.includes(type)) {
      setNotTypes(notTypes.filter(value => value !== type));
    }
    commit();
  }

  function toggleNotType(type: string) {
    const enablingExclude = !notTypes.includes(type);
    const values = nextValues(notTypes, type);
    setNotTypes(values);
    if (enablingExclude && activeTypes.includes(type)) {
      setIncludeRule('type', activeTypes.filter(value => value !== type), typeRule?.operator);
    }
    commit();
  }

  function toggleSubtype(subtype: string) {
    const enablingSubtype = !activeSubtypes.includes(subtype);
    const values = nextValues(activeSubtypes, subtype);
    setIncludeRule('subtypes', values, subtypeRule?.operator);
    if (enablingSubtype && notSubtypes.includes(subtype)) {
      setNotSubtypes(notSubtypes.filter(value => value !== subtype));
    }
    commit();
  }

  function toggleNotSubtype(subtype: string) {
    const enablingExclude = !notSubtypes.includes(subtype);
    const values = nextValues(notSubtypes, subtype);
    setNotSubtypes(values);
    if (enablingExclude && activeSubtypes.includes(subtype)) {
      setIncludeRule('subtypes', activeSubtypes.filter(value => value !== subtype), subtypeRule?.operator);
    }
    commit();
  }

  function applyCostRange() {
    const min = costMin === '' ? undefined : Number(costMin);
    const max = costMax === '' ? undefined : Number(costMax);

    if ((min == null || Number.isNaN(min)) && (max == null || Number.isNaN(max))) {
      removeAndRule('reserveCost');
    } else {
      setAndRule({
        field: 'reserveCost',
        ...(min != null && !Number.isNaN(min) ? { gte: min } : {}),
        ...(max != null && !Number.isNaN(max) ? { lte: max } : {}),
      });
    }
    commit();
  }

  function clearCostRange() {
    setCostMin('');
    setCostMax('');
    removeAndRule('reserveCost');
    commit();
  }

  function handleClear() {
    clearFilters();
    setCostMin('');
    setCostMax('');
    setElementSearch('');
    setClassSearch('');
    setTypeSearch('');
    setSubtypeSearch('');
    commit();
  }

  const standaloneChips = [
    ...(textSearch ? [{ key: 'text', label: `Text: ${textSearch}`, onRemove: () => { setTextSearch(''); commit(); } }] : []),
    ...(costRule ? [{
      key: 'cost',
      label: `Cost: ${costRule.gte ?? 0}-${costRule.lte ?? 'max'}`,
      onRemove: clearCostRange,
    }] : []),
  ];

  const includeGroups = [
    {
      key: 'elements',
      field: 'elements' as const,
      label: 'Element',
      values: activeElements,
      operator: (elementRule?.operator ?? 'OR') as FilterOperator,
      onRemove: toggleElement,
    },
    {
      key: 'classes',
      field: 'classes' as const,
      label: 'Class',
      values: activeClasses,
      operator: (classRule?.operator ?? 'OR') as FilterOperator,
      onRemove: toggleClass,
    },
    {
      key: 'type',
      field: 'type' as const,
      label: 'Type',
      values: activeTypes,
      operator: (typeRule?.operator ?? 'OR') as FilterOperator,
      onRemove: toggleType,
    },
    {
      key: 'subtypes',
      field: 'subtypes' as const,
      label: 'Subtype',
      values: activeSubtypes,
      operator: (subtypeRule?.operator ?? 'OR') as FilterOperator,
      onRemove: toggleSubtype,
    },
  ].filter(group => group.values.length > 0);

  const excludeChips = [
    ...notTypes.map(value => ({
      key: `not-type-${value}`,
      label: `Type: ${value}`,
      onRemove: () => toggleNotType(value),
    })),
    ...notSubtypes.map(value => ({
      key: `not-subtype-${value}`,
      label: `Subtype: ${value}`,
      onRemove: () => toggleNotSubtype(value),
    })),
  ];

  const hasActiveFilters = standaloneChips.length > 0 || includeGroups.length > 0 || excludeChips.length > 0;

  return (
    <div className="shrink-0 border-b border-gray-800 bg-[#0f1520] px-4 py-3">
      <div className="grid gap-3">
        <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
          placeholder="Search name or effect text..."
          value={textSearch}
          onChange={event => { setTextSearch(event.target.value); commit(); }}
        />
        <button
          type="button"
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:border-gray-500"
          onClick={handleClear}
        >
          Clear
        </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
        <IncludeFilterList
          title="Element"
          values={ELEMENTS}
          activeValues={activeElements}
          searchValue={elementSearch}
          onSearchChange={setElementSearch}
          onToggle={toggleElement}
          tone="blue"
          className="w-36"
        />
        <IncludeFilterList
          title="Class"
          values={CLASSES}
          activeValues={activeClasses}
          searchValue={classSearch}
          onSearchChange={setClassSearch}
          onToggle={toggleClass}
          tone="amber"
          className="w-36"
        />
        <IncludeExcludeFilterList
          title="Type"
          values={CARD_TYPES}
          activeValues={activeTypes}
          excludedValues={notTypes}
          searchValue={typeSearch}
          onSearchChange={setTypeSearch}
          onInclude={toggleType}
          onExclude={toggleNotType}
          className="w-44"
        />
        <IncludeExcludeFilterList
          title="Subtype"
          values={CARD_SUBTYPES}
          activeValues={activeSubtypes}
          excludedValues={notSubtypes}
          searchValue={subtypeSearch}
          onSearchChange={setSubtypeSearch}
          onInclude={toggleSubtype}
          onExclude={toggleNotSubtype}
          className="w-44"
        />
        </div>

        <div className="flex items-center gap-2">
        <span className="mr-1 w-14 text-xs font-medium text-gray-500">Cost</span>
        <input
          type="number"
          min={0}
          max={20}
          placeholder="Min"
          className="w-16 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
          value={costMin}
          onChange={event => setCostMin(event.target.value)}
          onBlur={applyCostRange}
          onKeyDown={event => { if (event.key === 'Enter') applyCostRange(); }}
        />
        <span className="text-xs text-gray-600">to</span>
        <input
          type="number"
          min={0}
          max={20}
          placeholder="Max"
          className="w-16 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
          value={costMax}
          onChange={event => setCostMax(event.target.value)}
          onBlur={applyCostRange}
          onKeyDown={event => { if (event.key === 'Enter') applyCostRange(); }}
        />
        </div>

        <div className="flex min-h-7 flex-wrap items-center gap-1.5 border-t border-gray-800 pt-2">
        <span className="mr-1 w-14 text-xs font-medium text-gray-500">Active</span>
        {!hasActiveFilters ? (
          <span className="text-xs text-gray-600">None</span>
        ) : (
          <>
            {standaloneChips.map(chip => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                className="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-xs text-gray-300 hover:border-red-500 hover:text-red-300"
                title="Click to remove filter"
              >
                {chip.label} ×
              </button>
            ))}
            {includeGroups.map(group => {
              const operator = group.values.length > 1 ? group.operator : 'AND';
              const separator = operator === 'AND' ? '&' : '|';
              const barClass = operator === 'AND'
                ? 'border-blue-800/60 bg-blue-950/20'
                : 'border-gray-700 bg-gray-900/80';

              return (
                <div
                  key={group.key}
                  className={`inline-flex items-center gap-0.5 rounded border px-1 py-0.5 ${barClass}`}
                  onDragOver={(event) => event.preventDefault()}
                >
                  {group.values.length > 1 ? (
                    <span className="inline-flex overflow-hidden rounded border border-gray-700">
                      {(['OR', 'AND'] as FilterOperator[]).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={operator === mode}
                          onClick={() => setIncludeOperator(group.field, mode)}
                          className={`px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                            operator === mode
                              ? 'bg-blue-700 text-white'
                              : 'bg-gray-950 text-gray-500 hover:text-gray-200'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className="pr-0.5 text-[10px] font-semibold text-blue-500">AND</span>
                  )}
                  {group.values.map((value, index) => {
                    const key = `${group.field}-${value}`;
                  return (
                    <span key={key} className="flex items-center gap-0.5">
                      {index > 0 && <span className="text-[10px] text-gray-600">{separator}</span>}
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDragChip({ field: group.field, value })}
                        onDragEnd={() => setDragChip(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleIncludeChipDrop(group.field, value)}
                        onClick={() => group.onRemove(value)}
                        className="cursor-grab rounded border border-blue-800/40 bg-blue-900/30 px-1.5 py-0.5 text-[11px] text-gray-300 hover:border-red-600 hover:text-red-300 active:cursor-grabbing"
                        title="Drag onto another chip in the same bar to AND them; click to remove"
                      >
                        {group.label}: {value} ×
                      </button>
                    </span>
                  );
                })}
                </div>
              );
            })}
            {excludeChips.length > 0 && (
              <div className="inline-flex items-center gap-0.5 rounded border border-red-800/60 bg-red-950/20 px-1 py-0.5">
                <span className="pr-0.5 text-[10px] font-semibold text-red-400">EXCLUDE</span>
                {excludeChips.map((chip, index) => (
                  <span key={chip.key} className="flex items-center gap-0.5">
                    {index > 0 && <span className="text-[10px] text-red-700">|</span>}
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      className="rounded border border-red-800/40 bg-red-900/30 px-1.5 py-0.5 text-[11px] text-gray-300 hover:border-red-600 hover:text-red-300"
                      title="Click to remove exclude filter"
                    >
                      {chip.label} ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
