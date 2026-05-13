import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Text, TextInput, Button, Card, ActivityIndicator, Checkbox } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { CustomDropdown } from '../components/CustomDropdown';

const CAP_TYPES: { value: string; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'daily', label: 'Daily' },
  { value: 'per_transaction', label: 'Per Transaction' },
];

const CASHBACK_TIMINGS: { value: string; label: string }[] = [
  { value: 'instant', label: 'Instant' },
  { value: 'current_statement', label: 'Current Statement' },
  { value: 'next_statement', label: 'Next Statement' },
];

export default function AddCategoryModal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { appTheme } = useTheme();
  const [categoryName, setCategoryName] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [splitCashback, setSplitCashback] = useState(false);
  const [cashback, setCashback] = useState('0');
  const [basePct, setBasePct] = useState('0');
  const [baseTiming, setBaseTiming] = useState('instant');
  const [baseCaps, setBaseCaps] = useState<{cap_type:string; cap_amount:string}[]>([]);
  const [acceleratedPct, setAcceleratedPct] = useState('0');
  const [acceleratedTiming, setAcceleratedTiming] = useState('instant');
  const [acceleratedCaps, setAcceleratedCaps] = useState<{cap_type:string; cap_amount:string}[]>([]);
  const [otherPct, setOtherPct] = useState('0');
  const [otherTiming, setOtherTiming] = useState('instant');
  const [otherCaps, setOtherCaps] = useState<{cap_type:string; cap_amount:string}[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!hasSupabaseEnv) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const { data } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .eq('is_closed', false)
        .order('name', { ascending: true });

      setCards(data || []);

      // Check if we're in edit mode
      const routeParams = route.params as any;
      if (routeParams?.categoryId) {
        setIsEditMode(true);
        setCategoryId(routeParams.categoryId);

        // Load the category
        const { data: categoryData, error: categoryError } = await supabase
          .from('card_categories')
          .select('*')
          .eq('id', routeParams.categoryId)
          .single();

        if (categoryError) {
          console.error('Error loading category:', categoryError);
          alert('Failed to load category');
          return;
        }

        if (categoryData) {
          setCategoryName(categoryData.name);
          setSelectedCardId(categoryData.card_id);
          // Prefill advanced fields if present
          setSplitCashback(!!(categoryData.accelerated_cashback_pct || categoryData.other_cashback_pct));
          setCashback((categoryData.base_cashback_pct || 0).toString());
          setBasePct((categoryData.base_cashback_pct || 0).toString());
          setBaseTiming(categoryData.base_cashback_timing || 'instant');
          setAcceleratedPct((categoryData.accelerated_cashback_pct || 0).toString());
          setAcceleratedTiming(categoryData.accelerated_cashback_timing || 'instant');
          setOtherPct((categoryData.other_cashback_pct || 0).toString());
          setOtherTiming(categoryData.other_cashback_timing || 'instant');
          // Load caps arrays if available
          if (Array.isArray(categoryData.base_cashback_caps)) {
            setBaseCaps(categoryData.base_cashback_caps.map((c:any) => ({ cap_type: c.cap_type, cap_amount: String(c.cap_amount) })));
          } else if (categoryData.base_cap_amount) {
            setBaseCaps([{ cap_type: categoryData.base_cap_type || 'monthly', cap_amount: String(categoryData.base_cap_amount) }]);
          }
          if (Array.isArray(categoryData.accelerated_cashback_caps)) {
            setAcceleratedCaps(categoryData.accelerated_cashback_caps.map((c:any) => ({ cap_type: c.cap_type, cap_amount: String(c.cap_amount) })));
          } else if (categoryData.accelerated_cap_amount) {
            setAcceleratedCaps([{ cap_type: categoryData.accelerated_cap_type || 'monthly', cap_amount: String(categoryData.accelerated_cap_amount) }]);
          }
          if (Array.isArray(categoryData.other_cashback_caps)) {
            setOtherCaps(categoryData.other_cashback_caps.map((c:any) => ({ cap_type: c.cap_type, cap_amount: String(c.cap_amount) })));
          } else if (categoryData.other_cap_amount) {
            setOtherCaps([{ cap_type: categoryData.other_cap_type || 'monthly', cap_amount: String(categoryData.other_cap_amount) }]);
          }
        }
      } else if (!selectedCardId && data && data.length > 0) {
        setSelectedCardId(data[0].id);
      }

      setInitialLoadComplete(true);
    };

    loadData();
  }, []);

  const handleAddCategory = async () => {
    if (!categoryName.trim() || !selectedCardId) {
      alert('Please fill in all fields');
      return;
    }

    // Basic validation for percentages
    const totalPct = splitCashback ? (parseFloat(basePct||'0') + parseFloat(acceleratedPct||'0') + parseFloat(otherPct||'0')) : parseFloat(cashback||'0');
    if (totalPct > 100) {
      alert('Total cashback percentage exceeds 100%');
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      if (isEditMode && categoryId) {
        // Update existing category
        const updatePayload:any = {
          name: categoryName.trim(),
          base_cashback_pct: splitCashback ? parseFloat(basePct||'0') : parseFloat(cashback||'0'),
          base_cashback_timing: baseTiming,
          base_cashback_caps: baseCaps.map(b => ({ cap_type: b.cap_type, cap_amount: parseFloat(b.cap_amount) })),
          accelerated_cashback_pct: splitCashback ? parseFloat(acceleratedPct||'0') : 0,
          accelerated_cashback_timing: acceleratedTiming,
          accelerated_cashback_caps: acceleratedCaps.map(b => ({ cap_type: b.cap_type, cap_amount: parseFloat(b.cap_amount) })),
          other_cashback_pct: splitCashback ? parseFloat(otherPct||'0') : 0,
          other_cashback_timing: otherTiming,
          other_cashback_caps: otherCaps.map(b => ({ cap_type: b.cap_type, cap_amount: parseFloat(b.cap_amount) })),
        };

        const { error } = await supabase
          .from('card_categories')
          .update(updatePayload)
          .eq('id', categoryId);

        if (error) throw error;
        alert('Category updated successfully');
      } else {
        // Create new category
        const insertPayload:any = {
          user_id: userId,
          card_id: selectedCardId,
          name: categoryName.trim(),
          base_cashback_pct: splitCashback ? parseFloat(basePct||'0') : parseFloat(cashback||'0'),
          base_cashback_timing: baseTiming,
          base_cashback_caps: baseCaps.map(b => ({ cap_type: b.cap_type, cap_amount: parseFloat(b.cap_amount) })),
          accelerated_cashback_pct: splitCashback ? parseFloat(acceleratedPct||'0') : 0,
          accelerated_cashback_timing: acceleratedTiming,
          accelerated_cashback_caps: acceleratedCaps.map(b => ({ cap_type: b.cap_type, cap_amount: parseFloat(b.cap_amount) })),
          other_cashback_pct: splitCashback ? parseFloat(otherPct||'0') : 0,
          other_cashback_timing: otherTiming,
          other_cashback_caps: otherCaps.map(b => ({ cap_type: b.cap_type, cap_amount: parseFloat(b.cap_amount) })),
        };

        const { error } = await supabase.from('card_categories').insert([insertPayload]);

        if (error) throw error;
        alert('Category added successfully');
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const addCap = (tier: 'base'|'accelerated'|'other') => {
    const row = { cap_type: 'monthly', cap_amount: '0' };
    if (tier === 'base') setBaseCaps(prev => [...prev, row]);
    if (tier === 'accelerated') setAcceleratedCaps(prev => [...prev, row]);
    if (tier === 'other') setOtherCaps(prev => [...prev, row]);
  };

  const updateCap = (tier: 'base'|'accelerated'|'other', idx: number, field: 'cap_type'|'cap_amount', value: string) => {
    const updater = (arr: any[], setFn: any) => {
      const copy = [...arr];
      copy[idx] = { ...copy[idx], [field]: value };
      setFn(copy);
    };
    if (tier === 'base') updater(baseCaps, setBaseCaps);
    if (tier === 'accelerated') updater(acceleratedCaps, setAcceleratedCaps);
    if (tier === 'other') updater(otherCaps, setOtherCaps);
  };

  const removeCap = (tier: 'base'|'accelerated'|'other', idx: number) => {
    const remover = (arr: any[], setFn: any) => {
      const copy = [...arr];
      copy.splice(idx, 1);
      setFn(copy);
    };
    if (tier === 'base') remover(baseCaps, setBaseCaps);
    if (tier === 'accelerated') remover(acceleratedCaps, setAcceleratedCaps);
    if (tier === 'other') remover(otherCaps, setOtherCaps);
  };

  const handleDeleteCategory = async () => {
    if (!categoryId) return;

    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('card_categories')
                .delete()
                .eq('id', categoryId);

              if (error) throw error;
              alert('Category deleted successfully');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting category:', error);
              alert('Failed to delete category');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, backgroundColor: appTheme.colors.background }} style={{ backgroundColor: appTheme.colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: appTheme.colors.surfaceVariant }}>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
          {isEditMode ? 'Edit Category' : 'Add Category'}
        </Text>
      </View>

      {!initialLoadComplete ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 16 }}>
        {/* Category Name first */}
        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Category Name
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g., Dining, Travel, Utilities"
            value={categoryName}
            onChangeText={setCategoryName}
            style={{ borderRadius: 4 }}
          />
        </View>

        {/* Card selection next */}
        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600', color: appTheme.colors.onSurface }}>
            Card *
          </Text>
          <CustomDropdown
            value={selectedCardId}
            options={cards.map((c) => ({ label: c.name, value: c.id }))}
            onSelect={(value) => setSelectedCardId(value as string)}
            placeholder="Select card"
          />
        </View>

        {/* Then the cashback controls */}
        <View>
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Checkbox status={splitCashback ? 'checked' : 'unchecked'} onPress={() => setSplitCashback(s => !s)} />
              <Text variant="labelMedium" style={{ fontWeight: '600' }}>Split Cashback (base / accelerated / other)</Text>
            </View>

            {!splitCashback ? (
              <View style={{ marginTop: 12 }}>
                <Text variant="labelSmall" style={{ marginBottom: 8 }}>Reward Rate (%)</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput style={{ flex: 1, borderRadius: 4 }} mode="outlined" keyboardType="numeric" value={cashback} onChangeText={setCashback} />
                  <View style={{ width: 160 }}>
                    <Text variant="labelSmall">When credited</Text>
                    <CustomDropdown
                      value={baseTiming}
                      options={CASHBACK_TIMINGS}
                      onSelect={(value) => setBaseTiming(value as string)}
                    />
                  </View>
                </View>

                    <View style={{ marginTop: 8 }}>
                      {baseCaps.length === 0 ? (
                        <Text variant="labelSmall">No cap</Text>
                      ) : (
                        <>
                          <Text variant="labelSmall">Base Caps</Text>
                          {baseCaps.map((c, i) => (
                            <View key={`b${i}`} style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                              <CustomDropdown
                                value={c.cap_type}
                                options={CAP_TYPES}
                                onSelect={(value) => updateCap('base', i, 'cap_type', value as string)}
                                style={{ flex: 1 }}
                              />
                            <TextInput style={{ width: 120, borderRadius: 4 }} mode="outlined" keyboardType="numeric" value={c.cap_amount} onChangeText={(v) => updateCap('base', i, 'cap_amount', v)} />
                              <Button mode="text" onPress={() => removeCap('base', i)}>Remove</Button>
                            </View>
                          ))}
                        </>
                      )}

                      <Button mode="outlined" onPress={() => addCap('base')} style={{ marginTop: 8 }}>
                        Add Cap
                      </Button>
                    </View>
              </View>
            ) : (
              <>
                <View style={{ marginTop: 12 }}>
                  <Text variant="labelSmall" style={{ marginBottom: 8 }}>Base %</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput style={{ flex: 1, borderRadius: 4 }} mode="outlined" keyboardType="numeric" value={basePct} onChangeText={setBasePct} />
                    <View style={{ width: 160 }}>
                      <Text variant="labelSmall">Base Timing</Text>
                      <CustomDropdown
                        value={baseTiming}
                        options={CASHBACK_TIMINGS}
                        onSelect={(value) => setBaseTiming(value as string)}
                      />
                    </View>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    {baseCaps.length === 0 ? (
                      <Text variant="labelSmall">No cap</Text>
                    ) : (
                      <>
                        <Text variant="labelSmall">Base Caps</Text>
                        {baseCaps.map((c, i) => (
                          <View key={`b${i}`} style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                            <CustomDropdown
                              value={c.cap_type}
                              options={CAP_TYPES}
                              onSelect={(value) => updateCap('base', i, 'cap_type', value as string)}
                              style={{ flex: 1 }}
                            />
                            <TextInput style={{ width: 120, borderRadius: 4 }} mode="outlined" keyboardType="numeric" value={c.cap_amount} onChangeText={(v) => updateCap('base', i, 'cap_amount', v)} />
                            <Button mode="text" onPress={() => removeCap('base', i)}>Remove</Button>
                          </View>
                        ))}
                      </>
                    )}

                    <Button mode="outlined" onPress={() => addCap('base')} style={{ marginTop: 8 }}>
                      Add Cap
                    </Button>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text variant="labelSmall" style={{ marginBottom: 8 }}>Accelerated %</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput style={{ flex: 1, borderRadius: 4 }} mode="outlined" keyboardType="numeric" value={acceleratedPct} onChangeText={setAcceleratedPct} />
                    <View style={{ width: 160 }}>
                      <Text variant="labelSmall">Accelerated Timing</Text>
                      <CustomDropdown
                        value={acceleratedTiming}
                        options={CASHBACK_TIMINGS}
                        onSelect={(value) => setAcceleratedTiming(value as string)}
                      />
                    </View>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    {acceleratedCaps.length === 0 ? (
                      <Text variant="labelSmall">No cap</Text>
                    ) : (
                      <>
                        <Text variant="labelSmall">Accelerated Caps</Text>
                        {acceleratedCaps.map((c, i) => (
                          <View key={`a${i}`} style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                            <CustomDropdown
                              value={c.cap_type}
                              options={CAP_TYPES}
                              onSelect={(value) => updateCap('accelerated', i, 'cap_type', value as string)}
                              style={{ flex: 1 }}
                            />
                            <TextInput style={{ width: 120, borderRadius: 4 }} mode="outlined" keyboardType="numeric" value={c.cap_amount} onChangeText={(v) => updateCap('accelerated', i, 'cap_amount', v)} />
                            <Button mode="text" onPress={() => removeCap('accelerated', i)}>Remove</Button>
                          </View>
                        ))}
                      </>
                    )}

                    <Button mode="outlined" onPress={() => addCap('accelerated')} style={{ marginTop: 8 }}>
                      Add Cap
                    </Button>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text variant="labelSmall" style={{ marginBottom: 8 }}>Other %</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput style={{ flex: 1, borderRadius: 4 }} mode="outlined" keyboardType="numeric" value={otherPct} onChangeText={setOtherPct} />
                    <View style={{ width: 160 }}>
                      <Text variant="labelSmall">Other Timing</Text>
                      <CustomDropdown
                        value={otherTiming}
                        options={CASHBACK_TIMINGS}
                        onSelect={(value) => setOtherTiming(value as string)}
                      />
                    </View>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    {otherCaps.length === 0 ? (
                      <Text variant="labelSmall">No cap</Text>
                    ) : (
                      <>
                        <Text variant="labelSmall">Other Caps</Text>
                        {otherCaps.map((c, i) => (
                          <View key={`o${i}`} style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                            <CustomDropdown
                              value={c.cap_type}
                              options={CAP_TYPES}
                              onSelect={(value) => updateCap('other', i, 'cap_type', value as string)}
                              style={{ flex: 1 }}
                            />
                            <TextInput style={{ width: 120, borderRadius: 4 }} mode="outlined" keyboardType="numeric" value={c.cap_amount} onChangeText={(v) => updateCap('other', i, 'cap_amount', v)} />
                            <Button mode="text" onPress={() => removeCap('other', i)}>Remove</Button>
                          </View>
                        ))}
                      </>
                    )}

                    <Button mode="outlined" onPress={() => addCap('other')} style={{ marginTop: 8 }}>
                      Add Cap
                    </Button>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'column', gap: 12, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button mode="outlined" style={{ flex: 1 }} onPress={() => navigation.goBack()} disabled={loading}>
              Cancel
            </Button>
            <Button mode="contained" style={{ flex: 1 }} onPress={handleAddCategory} loading={loading} disabled={loading}>
              {isEditMode ? 'Update' : 'Add'} Category
            </Button>
          </View>
          {isEditMode && (
            <Button
              mode="outlined"
              style={{ flex: 1 }}
              onPress={handleDeleteCategory}
              disabled={loading}
              textColor={appTheme.colors.error}
            >
              Delete Category
            </Button>
          )}
        </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}