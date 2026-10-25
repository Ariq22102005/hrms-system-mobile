import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import StatusNotice, { NoticeTone } from '../components/StatusNotice';
import Toolbar from '../components/Toolbar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildPayslipHtml } from '../services/payslip';
import { printPayslipWeb } from '../services/printPayslipWeb';

const PAD = 20;
const formatCurrency = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

export default function PayrollScreen() {
  const { employee } = useAuth();
  const { data, refresh, error: loadError } = useData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lock = useRef(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string | number | null>(null);
  const { t, language } = useLanguage();
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const payroll = data?.payroll.find((p) => p.id === selectedPeriod) ?? data?.payroll[0] ?? null;
  const basic = payroll?.basic_salary ?? 0;
  const allowance = payroll?.allowance ?? 0;
  const deductions = payroll?.deductions ?? 0;
  const net = payroll?.net_salary ?? 0;
  const period = payroll?.period ?? '';
  const hasPayslip = payroll !== null;
  const income = basic + allowance;
  const absence = payroll?.absence_deduction ?? 0;
  const otherDeductions = payroll?.other_deductions ?? 0;
  const L = language === 'en'
    ? { history: 'Payslip history', earned: 'Earnings', status: 'Payment status: processed', period: 'Pay period', absence: (n?: number) => `Absence${n ? ` (${n} days)` : ''}`, other: 'Other deductions', employee: 'Employee' }
    : { history: 'Riwayat slip gaji', earned: 'Pendapatan', status: 'Status pembayaran: diproses', period: 'Periode gaji', absence: (n?: number) => `Ketidakhadiran${n ? ` (${n} hari)` : ''}`, other: 'Potongan lain', employee: 'Karyawan' };
  const isLoading = !data && !loadError;
  async function downloadPayslip() {
    if (lock.current || !payroll || !employee) return;
    lock.current = true;
    setIsDownloading(true);
    setMessage(null);
    let temporaryPdf: string | undefined;
    try {
      const html = buildPayslipHtml(data?.employee ?? employee, payroll, language);
      if (Platform.OS === 'web') {
        await printPayslipWeb(html);
      } else {
        const result = await Print.printToFileAsync({ html });
        temporaryPdf = result.uri;
        if (Platform.OS === 'android') {
          const folder = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!folder.granted) { setMessage(t('pdfSaveCancelled')); return; }
          const filename = `PTI-${employee.id}-${period}`.replace(/[^A-Za-z0-9_-]/g, '-') + '.pdf';
          const target = await FileSystem.StorageAccessFramework.createFileAsync(folder.directoryUri, filename, 'application/pdf');
          const encoded = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.writeAsStringAsync(target, encoded, { encoding: FileSystem.EncodingType.Base64 });
          setMessage(t('payrollSaved')); return;
        } else if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: t('payrollDownload'), UTI: 'com.adobe.pdf' });
        } else {
          await Print.printAsync({ uri: result.uri });
        }
      }
      setMessage(t('payrollDownloaded'));
    } catch {
      setMessage(t('saveError'));
    } finally {
      if (temporaryPdf) await FileSystem.deleteAsync(temporaryPdf, { idempotent: true }).catch(() => setMessage(t('saveError')));
      lock.current = false;
      setIsDownloading(false);
    }
  }

  const card = { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border } as const;
  const tile = { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' } as const;
  const label = { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 4 } as const;
  const noticeTone: NoticeTone = message === t('saveError') ? 'danger' : message === t('pdfSaveCancelled') ? 'warning' : 'success';
  const statusTone = (status: string) => (/pending|draft|menunggu/i.test(status) ? 'warning' : 'success');
  const summary = [
    ['arrow-down-circle-outline', L.earned, income, colors.success],
    ['arrow-up-circle-outline', t('payrollDeductions'), deductions, colors.danger],
    ['wallet-outline', t('payrollNet'), net, colors.accent],
  ] as const;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 40, flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
      {/* Header: controls, page title and what this page is for */}
      <View style={{ backgroundColor: colors.primary, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingHorizontal: PAD, paddingTop: insets.top + 12, paddingBottom: 64, overflow: 'hidden' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', right: -14, bottom: -20, opacity: 0.12 }}><Ionicons name="wallet" size={160} color={colors.onPrimary} /></View>
        <Toolbar hideProfile onPrimary />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ color: colors.onPrimary, fontSize: 30, fontWeight: '800', marginTop: 8 }}>{t('payrollTitle')}</Text>
        <Text style={{ color: colors.onPrimary, fontSize: 14, lineHeight: 21, marginTop: 6, maxWidth: 420 }}>{t('payrollSubtitle')}</Text>
      </View>

      <View style={{ paddingHorizontal: PAD }}>
        {/* Overview card overlapping the header */}
        <View style={{ ...card, marginTop: -40, flexDirection: 'row', paddingVertical: 16, marginBottom: 24 }}>
          {summary.map(([icon, text, value, tone], index) => <View key={text} accessible accessibilityLabel={`${text}: ${hasPayslip ? formatCurrency(value) : '-'}`} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6, borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: colors.border }}>
            <Ionicons name={icon} size={20} color={tone} />
            <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 6, maxWidth: '100%' }}>{hasPayslip ? formatCurrency(value) : '—'}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{text}</Text>
          </View>)}
        </View>

        {/* Selected payslip */}
        <View style={{ ...card, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={tile}><Ionicons name="receipt-outline" size={24} color={colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>{t('payrollTitle')}</Text>
              {hasPayslip ? <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 2 }}>{period}</Text> : null}
            </View>
          </View>

          {hasPayslip ? <>
            <Text style={label}>{L.employee}</Text>
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '700' }}>{(data?.employee ?? employee)?.name} · {(data?.employee ?? employee)?.id}</Text>
            <Text style={{ ...label, marginTop: 20 }}>{t('payrollIncome')}</Text>
            <Line label={t('payrollBasic')} value={formatCurrency(basic)} />
            {allowance ? <Line label={t('allowance')} value={formatCurrency(allowance)} /> : null}
            <Text style={{ ...label, marginTop: 20 }}>{t('payrollDeductions')}</Text>
            <Line label={t('payrollDeductions')} value={`- ${formatCurrency(deductions)}`} />
            {absence > 0 ? <Line sub label={L.absence(payroll?.absent_days)} value={`- ${formatCurrency(absence)}`} /> : null}
            {otherDeductions > 0 ? <Line sub label={L.other} value={`- ${formatCurrency(otherDeductions)}`} /> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 14, padding: 14, marginTop: 16 }}>
              <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '800' }}>{t('payrollNet')}</Text>
              <Text style={{ color: colors.accent, fontSize: 17, fontWeight: '800' }}>{formatCurrency(net)}</Text>
            </View>
          </> : <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 16 }}>{isLoading ? '' : t('payrollUnavailable')}</Text>}

          <Pressable accessibilityRole="button" onPress={downloadPayslip} disabled={isDownloading || isLoading || !hasPayslip} style={({ pressed }) => ({ minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary, marginTop: 24, opacity: !hasPayslip || isLoading || isDownloading ? 0.6 : pressed ? 0.85 : 1 })}>
            {isDownloading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{t('payrollDownload')}</Text>}
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 12 }}>{t('pdfSaveHint')}</Text>
          {message ? <StatusNotice tone={noticeTone}>{message}</StatusNotice> : null}
        </View>

        {/* History */}
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 28, marginBottom: 12 }}>{L.history}</Text>
        {loadError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13, lineHeight: 19, marginBottom: 8 }}>{loadError}</Text> : null}
        {loadError ? <Pressable accessibilityRole="button" onPress={() => void refresh(true)} style={{ minHeight: 44, justifyContent: 'center', marginBottom: 8 }}><Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{t('retry')}</Text></Pressable> : null}
        {isLoading ? <ActivityIndicator color={colors.accent} /> : !data && loadError ? null : (data?.payroll.length ?? 0) === 0
          ? <View style={{ ...card, padding: 22, alignItems: 'center' }}><Ionicons name="wallet-outline" size={32} color={colors.muted} /><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, marginTop: 10, textAlign: 'center' }}>{t('payrollUnavailable')}</Text></View>
          : data?.payroll.map((p) => {
            const selected = p.id === payroll?.id;
            const tone = statusTone(p.status) === 'success' ? colors.success : colors.warning;
            const soft = statusTone(p.status) === 'success' ? colors.successSoft : colors.warningSoft;
            return <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${p.period}, ${formatCurrency(p.net_salary)}, ${p.status}`} onPress={() => { setSelectedPeriod(p.id); setMessage(null); }} style={({ pressed }) => ({ ...card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1, padding: 14, marginBottom: 12, flexDirection: 'row', gap: 12, opacity: pressed ? 0.85 : 1 })}>
              <View style={tile}><Ionicons name="receipt-outline" size={22} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, flexShrink: 1 }}>{p.period}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: soft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}><Ionicons name={statusTone(p.status) === 'success' ? 'checkmark-circle' : 'time-outline'} size={14} color={tone} /><Text style={{ color: tone, fontSize: 12, fontWeight: '800' }}>{sentence(p.status)}</Text></View>
                </View>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 4 }}>{t('payrollNet')} {formatCurrency(p.net_salary)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{t('payrollIncome')} {formatCurrency(p.basic_salary + (p.allowance ?? 0))} · {t('payrollDeductions')} {formatCurrency(p.deductions)}</Text>
              </View>
            </Pressable>;
          })}
      </View>
    </ScrollView>
  );
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function Line({ label, value, sub = false }: { label: string; value: string; sub?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingLeft: sub ? 16 : 0, borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <Text style={{ color: colors.muted, fontSize: sub ? 13 : 14, flexShrink: 1 }}>{label}</Text>
    <Text style={{ color: colors.ink, fontSize: sub ? 13 : 14, fontWeight: '700' }}>{value}</Text>
  </View>;
}
