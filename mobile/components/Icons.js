// Icônes SVG identiques à components/Icons.tsx + illustrations de Bienvenue.
import React from 'react';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { INK, useTheme } from '../theme';

function IconSvg({ children, size = 20, color = INK.texte }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function ChartIcon({ size = 18, color = INK.texte }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M3 3v18h18" />
      <Path d="M7 15v3M12 10v8M17 6v12" />
    </IconSvg>
  );
}

export function HistoryIcon({ size = 18, color = INK.texte }) {
  return (
    <IconSvg size={size} color={color}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 3" />
    </IconSvg>
  );
}

export function UserIcon({ size = 18, color = INK.texte }) {
  return (
    <IconSvg size={size} color={color}>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </IconSvg>
  );
}

export function PlusIcon({ size = 16, color = INK.texte }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M12 5v14M5 12h14" />
    </IconSvg>
  );
}

export function MinusIcon({ size = 16, color = INK.texte }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M5 12h14" />
    </IconSvg>
  );
}

export function RefreshIcon({ size = 16, color = INK.texte }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <Path d="M21 3v6h-6" />
    </IconSvg>
  );
}

export function LogoutIcon({ size = 16, color = INK.baisse }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17l5-5-5-5M21 12H9" />
    </IconSvg>
  );
}

export function CheckIcon({ size = 16, color = INK.hausse }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M4 12.5l5 5L20 6.5" />
    </IconSvg>
  );
}

export function ArrowUpIcon({ size = 16, color = '#FFFFFF' }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M12 19V5m0 0-6 6m6-6 6 6" />
    </IconSvg>
  );
}

export function ArrowDownIcon({ size = 16, color = '#FFFFFF' }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M12 5v14m0 0 6-6m-6 6-6-6" />
    </IconSvg>
  );
}

export function WalletIcon({ size = 14, color = INK.action }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M20 7H4a2 2 0 0 1 0-4h14v4" />
      <Path d="M20 7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5" />
      <Path d="M18 14h.01" />
    </IconSvg>
  );
}

export function XIcon({ size = 16, color = INK.doux }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M18 6 6 18M6 6l12 12" />
    </IconSvg>
  );
}

export function ChevronDownIcon({ size = 16, color = INK.doux }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M6 9l6 6 6-6" />
    </IconSvg>
  );
}

export function SignalIcon({ size = 18, color = INK.texte }) {
  return (
    <IconSvg size={size} color={color}>
      <Path d="M3 17l6-6 4 4 8-8" />
      <Path d="M15 7h6v6" />
    </IconSvg>
  );
}

/** Illustrations SVG de Bienvenue (identiques à app/bienvenue/page.tsx). */
export function SlideArt({ variant, t, zeroText }) {
  const { ink } = useTheme();
  if (variant === 0) {
    return (
      <Svg viewBox="0 0 200 140" width="100%" height={160}>
        <Rect x={30} y={70} width={16} height={40} rx={3} fill={ink.hausse} />
        <Rect x={36} y={58} width={4} height={64} fill={ink.hausse} />
        <Rect x={62} y={50} width={16} height={46} rx={3} fill={ink.hausse} />
        <Rect x={68} y={40} width={4} height={66} fill={ink.hausse} />
        <Rect x={94} y={66} width={16} height={42} rx={3} fill={ink.baisse} />
        <Rect x={100} y={52} width={4} height={66} fill={ink.baisse} />
        <Rect x={126} y={34} width={16} height={50} rx={3} fill={ink.hausse} />
        <Rect x={132} y={24} width={4} height={70} fill={ink.hausse} />
        <Rect x={158} y={52} width={16} height={38} rx={3} fill={ink.baisse} />
        <Rect x={164} y={42} width={4} height={58} fill={ink.baisse} />
        <SvgText x={100} y={130} textAnchor="middle" fill={ink.doux} fontSize={14}>
          {t('▲ monte · ▼ descend')}
        </SvgText>
      </Svg>
    );
  }
  if (variant === 1) {
    return (
      <Svg viewBox="0 0 200 140" width="100%" height={160}>
        <Path
          d="M10 110 L50 90 L80 100 L120 60 L150 70 L190 30"
          fill="none"
          stroke={ink.action}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={190} cy={30} r={7} fill={ink.hausse} />
        <SvgText x={100} y={130} textAnchor="middle" fill={ink.doux} fontSize={14}>
          {t('prix en direct')}
        </SvgText>
      </Svg>
    );
  }
  return (
    <Svg viewBox="0 0 200 140" width="100%" height={160}>
      <Rect x={55} y={25} width={90} height={70} rx={10} fill={ink.carte} stroke={ink.action} strokeWidth={3} />
      <SvgText x={100} y={58} textAnchor="middle" fill={ink.texte} fontSize={22} fontWeight="800">
        {zeroText}
      </SvgText>
      <SvgText x={100} y={80} textAnchor="middle" fill={ink.doux} fontSize={13}>
        {t('recharge pour jouer')}
      </SvgText>
      <Path
        d="M85 108l10 10 20-22"
        fill="none"
        stroke={ink.hausse}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
