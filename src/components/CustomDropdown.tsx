import React, { useState } from 'react';
import { View, ViewStyle } from 'react-native';
import { Button, Menu } from 'react-native-paper';

interface CustomDropdownProps {
  value: string | number;
  options: { label: string; value: string | number }[];
  onSelect: (value: string | number) => void;
  placeholder?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function CustomDropdown({ value, options, onSelect, placeholder, style, disabled = false }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder || String(value);

  return (
    <View style={[{ width: '100%' }, style]}
    >
      <Menu
        visible={isOpen}
        onDismiss={() => setIsOpen(false)}
        anchor={
          <Button
            mode="outlined"
            onPress={() => {
              if (!disabled) {
                setIsOpen(true);
              }
            }}
            disabled={disabled}
            style={{ justifyContent: 'center', borderRadius: 14, height: 56, borderWidth: 1.2, width: '100%' }}
            contentStyle={{ justifyContent: 'space-between', paddingHorizontal: 12, height: 56, alignItems: 'center' }}
            labelStyle={{ fontWeight: '600', flexWrap: 'wrap' }}
          >
            {selectedLabel}
          </Button>
        }
        contentStyle={{ maxWidth: 520, paddingVertical: 4 }}
      >
        {options.map((option) => (
          <Menu.Item
            key={option.value}
            onPress={() => {
              onSelect(option.value);
              setIsOpen(false);
            }}
            title={option.label}
            titleStyle={{ flexWrap: 'wrap' }}
          />
        ))}
      </Menu>
    </View>
  );
}
