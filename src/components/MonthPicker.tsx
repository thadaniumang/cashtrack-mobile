import React, { useState, useMemo } from 'react';
import { View, Modal, ViewStyle, ScrollView, Pressable } from 'react-native';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

interface MonthPickerProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
  style?: ViewStyle;
}

export function MonthPicker({ selectedDate, onChange, style }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempMonth, setTempMonth] = useState(selectedDate.getMonth());
  const [tempYear, setTempYear] = useState(selectedDate.getFullYear());
  const { appTheme } = useTheme();

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Generate list of available years (10 years back from today)
  const years = useMemo(() => {
    const list = [];
    for (let i = currentYear; i >= currentYear - 10; i--) {
      list.push(i);
    }
    return list;
  }, [currentYear]);

  // Generate list of available months (all 12, but restrict to current month if current year is selected)
  const months = useMemo(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    if (tempYear === currentYear) {
      return monthNames.slice(0, currentMonth + 1);
    }
    return monthNames;
  }, [tempYear, currentYear, currentMonth]);

  const handleConfirm = () => {
    const newDate = new Date(tempYear, tempMonth, 1);
    onChange(newDate);
    setIsOpen(false);
  };

  const monthYear = selectedDate.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={style}>
      <Button
        mode="outlined"
        icon="calendar-month-outline"
        labelStyle={{ fontWeight: '800', color: appTheme.colors.onSurface }}
        contentStyle={{ height: 46, paddingHorizontal: 12 }}
        style={{ borderRadius: 999, borderColor: appTheme.colors.outline, backgroundColor: appTheme.colors.surface, elevation: 2 }}
        onPress={() => {
          setTempMonth(selectedDate.getMonth());
          setTempYear(selectedDate.getFullYear());
          setIsOpen(true);
        }}
      >
        {monthYear}
      </Button>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: appTheme.colors.scrim }}>
          <View style={{ backgroundColor: appTheme.colors.surface, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: appTheme.colors.outlineVariant }} />
            </View>

            <View style={{ alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: appTheme.colors.surfaceVariant }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="calendar-range" size={18} color={appTheme.colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>
                Select Month & Year
              </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 24 }}>
              {/* Month Picker */}
              <View style={{ flex: 1, borderWidth: 0, borderRadius: 12, maxHeight: 220, backgroundColor: appTheme.colors.surfaceVariant, padding: 8 }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {months.map((m, i) => (
                    <Pressable
                      key={i}
                      onPress={() => setTempMonth(i)}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        marginHorizontal: 6,
                        marginVertical: 6,
                        borderRadius: 12,
                        backgroundColor: tempMonth === i ? appTheme.colors.primaryContainer : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          color: tempMonth === i ? appTheme.colors.onPrimaryContainer : appTheme.colors.onSurface,
                          fontWeight: tempMonth === i ? '700' : '500',
                          textAlign: 'center',
                        }}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Year Picker */}
              <View style={{ flex: 1, borderWidth: 0, borderRadius: 12, maxHeight: 220, backgroundColor: appTheme.colors.surfaceVariant, padding: 8 }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {years.map((y) => (
                    <Pressable
                      key={y}
                      onPress={() => setTempYear(y)}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        marginHorizontal: 6,
                        marginVertical: 6,
                        borderRadius: 12,
                        backgroundColor: tempYear === y ? appTheme.colors.primaryContainer : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          color: tempYear === y ? appTheme.colors.onPrimaryContainer : appTheme.colors.onSurface,
                          fontWeight: tempYear === y ? '700' : '500',
                          textAlign: 'center',
                        }}
                      >
                        {y}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
              <Button
                mode="outlined"
                onPress={() => setIsOpen(false)}
                style={{ flex: 1, borderRadius: 12 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleConfirm}
                style={{ flex: 1, borderRadius: 12 }}
              >
                Confirm
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
