import { useEffect, useMemo, useState } from 'react';
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

function normal(value: string) {
  return value.trim().toLowerCase();
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

  const stateListId = useMemo(() => `state-master-${Math.random().toString(36).slice(2)}`, []);
  const cityListId = useMemo(() => `city-master-${Math.random().toString(36).slice(2)}`, []);

  const stateClass = `${inputClassName} ${stateError ? 'border-red-500 focus:border-red-500' : 'border-gray-200 focus:border-gray-400'}`;
  const cityClass = `${inputClassName} ${cityError ? 'border-red-500 focus:border-red-500' : 'border-gray-200 focus:border-gray-400'}`;

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
      <label className="block">
        <span className="form-label">{cityLabel}{required ? ' *' : ''}</span>
        <input
          list={cityListId}
          value={city}
          onChange={event => handleCityChange(event.target.value)}
          className={cityClass}
          placeholder="Search city"
        />
        <datalist id={cityListId}>
          {cities.map(item => (
            <option key={item.id} value={item.name}>{item.state?.name}</option>
          ))}
        </datalist>
        {cityError && <span className="mt-1 block text-xs font-medium text-red-600">{cityError}</span>}
      </label>
      <label className="block">
        <span className="form-label">{stateLabel}{required ? ' *' : ''}</span>
        <input
          list={stateListId}
          value={state}
          onChange={event => handleStateChange(event.target.value)}
          className={stateClass}
          placeholder="Search state"
        />
        <datalist id={stateListId}>
          {states.map(item => (
            <option key={item.id} value={item.name}>{item.type === 'union_territory' ? 'Union Territory' : 'State'}</option>
          ))}
        </datalist>
        {stateError && <span className="mt-1 block text-xs font-medium text-red-600">{stateError}</span>}
      </label>
    </div>
  );
}
