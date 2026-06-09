/**
 * Design-system namespace.
 *
 * The Zitting Finance screens were authored against a generated runtime bundle
 * exposed as `window.ZittingHQDesignSystem_c9e528`. We reproduce that exact
 * surface here by importing every component and collecting it into one object,
 * which the client entry assigns to window before the app renders.
 */
import { Avatar } from "./components/core/Avatar";
import { Badge } from "./components/core/Badge";
import { Button } from "./components/core/Button";
import { Card, SectionHeader } from "./components/core/Card";
import { Icon } from "./components/core/Icon";
import { IconButton } from "./components/core/IconButton";
import { SegmentedControl } from "./components/core/SegmentedControl";
import { Tabs } from "./components/core/Tabs";
import { Tag } from "./components/core/Tag";
import { Toggle } from "./components/core/Toggle";
import { TextInput } from "./components/core/TextInput";
import { Select } from "./components/core/Select";
import { Checkbox } from "./components/core/Checkbox";

import { AreaChart } from "./components/data/AreaChart";
import { ChecklistRow } from "./components/data/ChecklistRow";
import { DataTable, AmountCell } from "./components/data/DataTable";
import { DonutChart, DonutLegend } from "./components/data/DonutChart";
import { ProgressBar, BudgetRow } from "./components/data/ProgressBar";
import { Sparkline } from "./components/data/Sparkline";
import { Delta, StatTile } from "./components/data/StatTile";

import {
  Skeleton,
  SkeletonText,
  Spinner,
  LoadingBar,
} from "./components/feedback/Skeleton";
import { Modal } from "./components/feedback/Modal";
import { EmptyState } from "./components/feedback/EmptyState";
import { FileDropzone } from "./components/data/FileDropzone";

export const DS = {
  Avatar,
  Badge,
  Button,
  Card,
  SectionHeader,
  Icon,
  IconButton,
  SegmentedControl,
  Tabs,
  Tag,
  Toggle,
  AreaChart,
  ChecklistRow,
  DataTable,
  AmountCell,
  DonutChart,
  DonutLegend,
  ProgressBar,
  BudgetRow,
  Sparkline,
  Delta,
  StatTile,
  Skeleton,
  SkeletonText,
  Spinner,
  LoadingBar,
  TextInput,
  Select,
  Checkbox,
  Modal,
  EmptyState,
  FileDropzone,
};

export type DSNamespace = typeof DS;
