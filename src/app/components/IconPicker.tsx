import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Button } from './ui/button';

interface IconPickerProps {
  selectedIcon: string;
  onIconSelect: (iconName: string) => void;
  className?: string;
}

const iconOptions = [
  'Circle', 'Square', 'Triangle', 'Diamond', 'Star', 'Heart', 'Home', 'Building', 'Office',
  'ShoppingBag', 'ShoppingCart', 'Package', 'Box', 'Gift', 'GiftCard', 'CreditCard', 'Wallet',
  'Utensils', 'Coffee', 'Pizza', 'Cake', 'Apple', 'Wine', 'Bread', 'Fish', 'Meat',
  'Car', 'Bus', 'Train', 'Plane', 'Bicycle', 'Motorcycle', 'Truck', 'Taxi',
  'Film', 'Music', 'Gamepad', 'Headphones', 'Microphone', 'Camera', 'Video', 'Tv',
  'HeartPulse', 'Stethoscope', 'Pill', 'Apple', 'Droplet', 'Brain', 'Tooth', 'Shield',
  'Zap', 'Lightbulb', 'Battery', 'Plug', 'Wind', 'Cloud', 'Umbrella', 'Thermometer',
  'Home', 'Building', 'Office', 'Shop', 'Store', 'MapPin', 'Location', 'Globe',
  'Landmark', 'Bank', 'CreditCard', 'DollarSign', 'TrendingUp', 'TrendingDown', 'BarChart',
  'Briefcase', 'Laptop', 'Computer', 'Printer', 'Phone', 'Tablet', 'Watch', 'Clock',
  'Shirt', 'Shoe', 'Hat', 'Glasses', 'Hair', 'User', 'Users', 'UserCircle',
  'Tree', 'Flower', 'Leaf', 'Sun', 'Moon', 'Cloud', 'Rain', 'Snow',
  'HelpCircle', 'Info', 'AlertCircle', 'AlertTriangle', 'CheckCircle', 'XCircle',
  'Plus', 'Minus', 'X', 'Check', 'Edit', 'Trash2', 'Save', 'Settings',
  'Search', 'Filter', 'Calendar', 'Clock', 'Map', 'Navigation', 'Compass', 'Pin',
  'Phone', 'Mail', 'MessageSquare', 'Send', 'Download', 'Upload', 'Share', 'Copy',
  'Lock', 'Unlock', 'Key', 'Shield', 'Security', 'Fingerprint', 'Eye', 'EyeOff',
  'Heart', 'Smile', 'Frown', 'Meh', 'ThumbsUp', 'ThumbsDown', 'Star', 'Award',
  'Play', 'Pause', 'Stop', 'SkipBack', 'SkipForward', 'Volume', 'Volume2', 'VolumeX',
  'Image', 'Picture', 'Camera', 'Video', 'Music', 'File', 'Folder', 'Archive'
];

export const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onIconSelect, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getIconComponent = (iconName: string) => {
    const IconComponent = LucideIcons[iconName as keyof typeof LucideIcons] || LucideIcons.Circle;
    return <IconComponent className="w-5 h-5" />;
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-primary hover:bg-bg-card"
      >
        <div className="flex items-center gap-2">
          {getIconComponent(selectedIcon)}
          <span className="text-sm">{selectedIcon}</span>
        </div>
        <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full max-h-64 overflow-y-auto bg-bg-card border border-border-main rounded-lg shadow-lg">
          <div className="grid grid-cols-8 gap-2 p-3">
            {iconOptions.map((iconName) => (
              <button
                key={iconName}
                type="button"
                onClick={() => {
                  onIconSelect(iconName);
                  setIsOpen(false);
                }}
                className={`p-2 rounded-lg border transition-colors ${
                  selectedIcon === iconName
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-border-main hover:border-border-text hover:bg-bg-input'
                }`}
                title={iconName}
              >
                {getIconComponent(iconName)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};