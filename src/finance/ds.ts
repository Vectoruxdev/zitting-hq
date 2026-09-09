/**
 * Design-system namespace for the finance screens.
 *
 * The 23 finance screens were authored against a generated runtime bundle
 * exposed as `window.ZittingHQDesignSystem_c9e528`. Since the 2026-09 revamp
 * that surface is served by ds-adapter.tsx (old prop contracts → the new
 * components in src/ui) for everything with a faithful equivalent, and by the
 * original implementations (now reading the new tokens) for the rest. The
 * client entry assigns this object to window before the app renders.
 */
import {
  Icon, Button, IconButton, Avatar, Badge, Tag, Tabs, SegmentedControl, Select, TextInput, Toggle, Checkbox,
  Modal, EmptyState, Skeleton, Sparkline, ProgressBar,
} from "./ds-adapter";

// Kept on the original implementation (no faithful src/ui equivalent yet — Phase 6).
import { Card, SectionHeader } from "./components/core/Card";
import { AreaChart } from "./components/data/AreaChart";
import { ChecklistRow } from "./components/data/ChecklistRow";
import { DataTable, AmountCell } from "./components/data/DataTable";
import { DonutChart, DonutLegend } from "./components/data/DonutChart";
import { BudgetRow } from "./components/data/ProgressBar";
import { Delta, StatTile } from "./components/data/StatTile";
import { SkeletonText, Spinner, LoadingBar } from "./components/feedback/Skeleton";
import { FileDropzone } from "./components/data/FileDropzone";

export const DS = {
  Avatar, Badge, Button, Card, SectionHeader, Icon, IconButton, SegmentedControl, Tabs, Tag, Toggle,
  AreaChart, ChecklistRow, DataTable, AmountCell, DonutChart, DonutLegend, ProgressBar, BudgetRow, Sparkline, Delta, StatTile,
  Skeleton, SkeletonText, Spinner, LoadingBar, Modal, EmptyState, FileDropzone, TextInput, Select, Checkbox,
};
