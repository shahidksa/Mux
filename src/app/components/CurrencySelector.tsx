import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

export function CurrencySelector({ 
  value, onChange, label = "Currency", placeholder = "Choose a currency", className = "" 
}) {

  const currencies = useLiveQuery(() => 
    db.currencies.toArray().then(arr => {
      const unique = Array.from(new Map(arr.map(item => [item.code, item])).values());
      return unique.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.code.localeCompare(b.code);
      });
    })
  ) || [];

  return (
    <div className={`space-y-3 ${className}`}>
      {label && <Label>{label}</Label>}
      
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {currencies.map((curr) => (
            <SelectItem key={curr.id} value={curr.code}>
              <span>{curr.symbol} {curr.code} — {curr.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
