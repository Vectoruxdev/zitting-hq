/**
 * Zitting HQ design system — the guide's component set, ported to TypeScript.
 * Source of truth: the Claude Design project "Zitting HQ Design System"
 * (vendored, gitignored, at ds-bundle/). Import from "@/ui", never from
 * component internals (mirrors the guide's _adherence rule).
 */
export * from "./interact";

// core
export { Icon, ICONS, hasIcon, type IconProps, type IconName } from "./core/Icon";
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./core/Button";
export { IconButton, type IconButtonProps } from "./core/IconButton";
export { Input, Field, type InputProps, type FieldProps } from "./core/Input";
export { Textarea, type TextareaProps } from "./core/Textarea";
export { Select, type SelectProps, type SelectOption } from "./core/Select";
export { RadioGroup, type RadioGroupProps, type RadioOption } from "./core/RadioGroup";
export { Toggle, type ToggleProps } from "./core/Toggle";
export { Checkbox, type CheckboxProps } from "./core/Checkbox";
export { Stepper, type StepperProps } from "./core/Stepper";
export { SearchField, type SearchFieldProps } from "./core/SearchField";

// navigation
export { AppShell, useShellMode, Wordmark, type AppShellProps, type ShellModule, type ShellMode } from "./navigation/AppShell";
export { TabBar, type TabBarProps, type TabBarItem, type TabBarAction } from "./navigation/TabBar";
export { Tabs, type TabsProps, type TabItem } from "./navigation/Tabs";
export { SegmentedControl, type SegmentedControlProps, type SegmentItem } from "./navigation/SegmentedControl";

// display
export { Section, type SectionProps } from "./display/Section";
export { Row, type RowProps } from "./display/Row";
export { ModuleTile, type ModuleTileProps } from "./display/ModuleTile";
export { Badge, type BadgeProps, type BadgeTone } from "./display/Badge";
export { Tag, type TagProps } from "./display/Tag";
export { Avatar, AvatarStack, type AvatarProps, type AvatarStackProps, type AvatarSize } from "./display/Avatar";
export { Card, type CardProps } from "./display/Card";
export { Money, type MoneyProps } from "./display/Money";
export { CountUp, useCountUp, type CountUpProps } from "./display/CountUp";
export { StatTile, type StatTileProps } from "./display/StatTile";
export { WeekStrip, type WeekStripProps, type WeekDay } from "./display/WeekStrip";
export { QuoteCard, type QuoteCardProps } from "./display/QuoteCard";
export { DetailList, type DetailListProps, type DetailItem } from "./display/DetailList";

// overlays
export { Modal, useDialog, useExit, type ModalProps } from "./overlays/Modal";
export { BottomSheet, type BottomSheetProps } from "./overlays/BottomSheet";
export { Drawer, type DrawerProps } from "./overlays/Drawer";
export { useVisibleViewport, visibleBox, keyboardUp, overlayFrame, useOverlayHost, inOverlayHost, type VisibleBox } from "./overlays/viewport";
export { Toast, ToastProvider, useToast, type ToastOptions, type ToastTone } from "./overlays/Toast";
export { Tooltip, type TooltipProps } from "./overlays/Tooltip";

// data
export { FlowBar, type FlowBarProps, type FlowSegment } from "./data/FlowBar";
export { DataTable, type DataTableProps, type DataColumn, type SortState } from "./data/DataTable";
export { AreaChart, type AreaChartProps, type AreaSeries } from "./data/AreaChart";
export { DonutChart, type DonutChartProps, type DonutSegment } from "./data/DonutChart";
export { Sparkline, type SparklineProps } from "./data/Sparkline";
export { ProgressBar, type ProgressBarProps } from "./data/ProgressBar";
export { ProgressRing, type ProgressRingProps } from "./data/ProgressRing";
export { ChartTooltip, ChartEmpty, drawIn, type ChartTooltipProps, type ChartTooltipRow } from "./data/ChartTooltip";

// feedback
export { EmptyState, type EmptyStateProps } from "./feedback/EmptyState";
export { Skeleton, SkeletonCard, type SkeletonProps, type SkeletonCardProps } from "./feedback/Skeleton";
export { Reveal, Stagger, type RevealProps, type StaggerProps } from "./feedback/Reveal";
export { Celebrate, type CelebrateProps } from "./feedback/Celebrate";
export { InlineAlert, type InlineAlertProps, type AlertTone } from "./feedback/InlineAlert";

// photo
export { ImageCard, type ImageCardProps } from "./photo/ImageCard";
export { AlbumTile, type AlbumTileProps } from "./photo/AlbumTile";
export { PhotoGrid, type PhotoGridProps, type PhotoItem } from "./photo/PhotoGrid";
export { PhotoHero, type PhotoHeroProps } from "./photo/PhotoHero";
export { Lightbox, type LightboxProps, type LightboxItem } from "./photo/Lightbox";
export { Dropzone, type DropzoneProps, type DropFile } from "./photo/Dropzone";
