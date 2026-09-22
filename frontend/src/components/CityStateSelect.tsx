import { useEffect, useMemo, useRef, useState } from 'react';
import { listActiveCities, listActiveStates, StateMaster, CityMaster } from '../services/locationMasterService';

type Props = {
  city: string;
  state: string;
  onCityChange: (value: string) => void;
  onStateChange: (value: string) => void;
  cityLabel?: string;
  stateLabel?: string;
  cityError?: string;
  stateError?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
};

const baseInput = 'w-full px-3 py-2 rounded-xl border text-sm outline-none bg-white';
const dropdownClass = 'absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl';

function normal(value: string) {
  return value.trim().toLowerCase();
}

type SearchOption = {
  id: string;
  label: string;
  meta?: string;
};

function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  inputClassName,
  error,
  required,
  disabled = false,
  emptyText = 'No matches found',
}: {
  label: string;
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  placeholder: string;
  inputClassName: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const filteredOptions = useMemo(() => {
    const query = normal(value);
    if (!query) return options;
    return options.filter(option => (
      normal(option.label).includes(query) || normal(option.meta || '').includes(query)
    ));
  }, [options, value]);

  return (
    <label ref={rootRef} className="relative block">
      <span className="form-label">{label}{required ? ' *' : ''}</span>
      <input
        value={value}
        onChange={event => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={inputClassName}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      {open && !disabled && (
        <div className={dropdownClass}>
          {filteredOptions.length > 0 ? filteredOptions.map(option => (
            <button
              key={option.id}
              type="button"
              className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                onChange(option.label);
                setOpen(false);
              }}
            >
              <span className="font-medium">{option.label}</span>
              {option.meta && <span className="shrink-0 text-xs text-slate-400">{option.meta}</span>}
            </button>
          )) : (
            <div className="px-3 py-2 text-sm text-slate-400">{emptyText}</div>
          )}
        </div>
      )}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export default function CityStateSelect({
  city,
  state,
  onCityChange,
  onStateChange,
  cityLabel = 'City',
  stateLabel = 'State',
  cityError,
  stateError,
  className = 'grid grid-cols-1 md:grid-cols-2 gap-3',
  inputClassName = baseInput,
  required = false,
}: Props) {
  const [states, setStates] = useState<StateMaster[]>([]);
  const [cities, setCities] = useState<CityMaster[]>([]);
  const [cityQuery, setCityQuery] = useState(city);

  useEffect(() => {
    listActiveStates().then(setStates).catch(() => setStates([]));
  }, []);

  const selectedState = useMemo(
    () => states.find(item => normal(item.name) === normal(state)),
    [state, states],
  );

  useEffect(() => {
    setCityQuery(city);
  }, [city]);

  useEffect(() => {
    listActiveCities({ state_id: selectedState?.id, q: cityQuery || undefined })
      .then(setCities)
      .catch(() => setCities([]));
  }, [selectedState?.id, cityQuery]);

  const stateClass = `${inputClassName} ${stateError ? 'border-red-500 focus:border-red-500' : 'border-gray-200 focus:border-gray-400'}`;
  const cityClass = `${inputClassName} ${cityError ? 'border-red-500 focus:border-red-500' : 'border-gray-200 focus:border-gray-400'}`;

  const stateOptions = useMemo(() => states.map(item => ({
    id: item.id,
    label: item.name,
    meta: item.type === 'union_territory' ? 'Union Territory' : 'State',
  })), [states]);

  const cityOptions = useMemo(() => cities.map(item => ({
    id: item.id,
    label: item.name,
    meta: item.state?.name,
  })), [cities]);

  const handleStateChange = (value: string) => {
    onStateChange(value);
    const exact = states.find(item => normal(item.name) === normal(value));
    if (!exact) onCityChange('');
  };

  const handleCityChange = (value: string) => {
    setCityQuery(value);
    onCityChange(value);
    const exact = cities.find(item => normal(item.name) === normal(value));
    if (exact?.state?.name && normal(exact.state.name) !== normal(state)) {
      onStateChange(exact.state.name);
    }
  };

  return (
    <div className={className}>
      <SearchableSelect
        label={stateLabel}
        value={state}
        options={stateOptions}
        onChange={handleStateChange}
        inputClassName={stateClass}
        placeholder="Type and select state"
        error={stateError}
        required={required}
        emptyText="No state found"
      />
      <SearchableSelect
        label={cityLabel}
        value={city}
        options={cityOptions}
        onChange={handleCityChange}
        inputClassName={cityClass}
        placeholder={selectedState ? 'Type and select city' : 'Select state first'}
        error={cityError}
        required={required}
        disabled={!selectedState}
        emptyText={selectedState ? 'No city found' : 'Select state first'}
      />
    </div>
  );
}
