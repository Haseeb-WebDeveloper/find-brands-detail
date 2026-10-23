import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Asterisk,
  ArrowUpRight,
  Banknote,
  Bell,
  Briefcase,
  Calculator,
  Calendar,
  CalendarCheck,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleCheck,
  CloudLightning,
  ClipboardCheck,
  Clock,
  Copy,
  Ellipsis,
  Download,
  File as FileIcon,
  FileText,
  GripVertical,
  HardHat,
  History,
  CircleHelp,
  House,
  Inbox,
  Laptop,
  LifeBuoy,
  LogOut,
  MapPin,
  Megaphone,
  Monitor,
  Menu,
  MessageCircle,
  PanelLeft,
  Moon,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  Share,
  Smartphone,
  Ruler,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserPlus,
  TriangleAlert,
  Undo2,
  Users,
  X,
  type LucideIcon,
  ClipboardList,
  Eye,
  Globe,
  EyeOff,
  Mail,
  Play,
  Info,
  LoaderCircle,
  Mic,
  Paperclip,
  Pause,
  Reply,
  RotateCcw,
  Send,
  Square,
  Crop,
  ImageIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "./cn";

/**
 * Our icons. Lucide's artwork, drawn the way this language draws a symbol.
 *
 * Our names describe MEANING (`quote`, not `file-text`), so the glyph behind a name can change
 * without touching a call site. Add a name here, importing only what is used, so the bundle carries
 * only what is used. Config objects carry the name, a string, never the component: a Server
 * Component cannot hand a function to a Client Component.
 *
 * This is ours alone. The roofing template keeps its own `<Icon>` and its own table.
 */
const ICONS = {
  add: Plus,
  archive: Archive,
  assistant: Asterisk,
  arrowDown: ArrowDown,
  arrowUp: ArrowUp,
  assign: UserPlus,
  back: ArrowLeft,
  bell: Bell,
  calendar: Calendar,
  estimate: Calculator,
  camera: Camera,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronExpand: ChevronsUpDown,
  close: X,
  copy: Copy,
  crew: HardHat,
  customers: Users,
  dark: Moon,
  delete: Trash2,
  done: CircleCheck,
  storm: CloudLightning,
  edit: Pencil,
  eye: Eye,
  website: Globe,
  eyeOff: EyeOff,
  mail: Mail,
  play: Play,
  report: ClipboardList,
  external: ArrowUpRight,
  help: CircleHelp,
  info: Info,
  /** Something is on its way. Spun with `animate-spin`. */
  loader: LoaderCircle,
  /** Add a file or screenshot to a message. */
  attach: Paperclip,
  /** Record a voice note. */
  mic: Mic,
  pause: Pause,
  /** A document on a message: a PDF, a spreadsheet. */
  file: FileIcon,
  download: Download,
  /** Answer one message, quoting it. */
  reply: Reply,
  retry: RotateCcw,
  send: Send,
  /** Stop something that is running: a reply being written. */
  stop: Square,
  /** A past conversation with the assistant. Not a chat bubble: that is the Inbox. */
  conversation: History,
  filter: SlidersHorizontal,
  grip: GripVertical,
  home: House,
  inspection: ClipboardCheck,
  inbox: Inbox,
  job: Briefcase,
  /** The preview frame: how a page looks on a computer. */
  laptop: Laptop,
  /** A measured roof. */
  measure: Ruler,
  /** The preview frame: how a page looks on a phone. Not `phone`, which is a call. */
  mobile: Smartphone,
  light: Sun,
  menu: Menu,
  message: MessageCircle,
  money: Banknote,
  more: Ellipsis,
  move: ArrowRight,
  phone: Phone,
  place: MapPin,
  quote: FileText,
  search: Search,
  settings: Settings,
  share: Share,
  social: Megaphone,
  signOut: LogOut,
  sidebar: PanelLeft,
  support: LifeBuoy,
  system: Monitor,
  time: Clock,
  today: CalendarCheck,
  undo: Undo2,
  warning: TriangleAlert,
  crop: Crop,
  image: ImageIcon,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Every name `<Icon>` accepts — lets config objects (the nav) be checked against the set. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/**
 * The stroke follows the weight of the words beside it, the way Apple's symbols do: a semibold
 * label never sits next to a hairline icon. Values are on Lucide's 24-unit grid and scale with size.
 */
const STROKE = { light: 1.5, regular: 1.75, medium: 2, semibold: 2.25, bold: 2.5 } as const;

export type IconWeight = keyof typeof STROKE;

/**
 * Sized from the text around it (1.25 times its size) unless a `size-*` class says otherwise, so an
 * icon in a 17px button and one in a 13px footnote are each right without anybody choosing.
 */
export function Icon({
  name,
  weight = "medium",
  className,
  label,
}: {
  name: IconName;
  weight?: IconWeight;
  className?: string;
  /** Only when the icon stands alone and means something. Otherwise it is hidden from readers. */
  label?: string;
}) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      strokeWidth={STROKE[weight]}
      className={cn("size-[1.25em] shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
