
import React from 'react';
import { 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Pause, 
  Play, 
  RotateCcw, 
  Eraser, 
  Pencil, 
  Undo2, 
  Check, 
  Volume2,
  VolumeX,
  Eye,
  Trash2,
  X,
  Home,
  ShoppingBag,
  Diamond,
  Video,
  Smartphone,
  Gift,
  Clock,
  Sun,
  Moon,
  Laptop,
  Lock,
  Unlock, // Changed from LockOpen
  Film,
  BarChart3,
  Hand,
  BatteryCharging,
  Sparkles,
  CassetteTape,
  Wind,
  Drum,
  Share,
  Info,
  Search,
  Keyboard,
  Gamepad2,
  Droplets,
  Music,
  Music2,
  AudioLines,
  FileText,
  Waves,
  Piano,
  Guitar,
  Smile,
  StickyNote,
  Trees,
  GlassWater,
  Bell,
  Heart,
  Trophy,
  User,
  Medal,
  Flame,
  Star,
  Crown,
  Fish,
  Mountain,
  Disc,
  CircleDot,
  Flower2,
  Gem,
  Hexagon,
  Ticket,
  Terminal
} from 'lucide-react';

type SkillAssetIconProps = React.ImgHTMLAttributes<HTMLImageElement>;

const SkillAssetIcon = ({ className = '', alt = '', ...props }: SkillAssetIconProps & { src: string }) => (
  <img
    {...props}
    alt={alt}
    aria-hidden={alt ? undefined : true}
    className={`block object-contain object-center select-none pointer-events-none ${className}`}
    draggable={false}
  />
);

export const Icons = {
  Dev: (props: any) => <Terminal {...props} />,
  Settings: (props: any) => <Settings {...props} />,
  Back: (props: any) => <ChevronLeft {...props} />,
  Next: (props: any) => <ChevronRight {...props} />,
  Pause: (props: any) => <Pause {...props} />,
  Play: (props: any) => <Play {...props} />,
  Reset: (props: any) => <RotateCcw {...props} />,
  Erase: (props: any) => <Eraser {...props} />,
  Pencil: (props: any) => <Pencil {...props} />,
  Undo: (props: any) => <Undo2 {...props} />,
  Check: (props: any) => <Check {...props} />,
  Sound: (props: any) => <Volume2 {...props} />,
  Mute: (props: any) => <VolumeX {...props} />,
  Eye: (props: any) => <Eye {...props} />,
  Trash: (props: any) => <Trash2 {...props} />,
  Close: (props: any) => <X {...props} />,
  Home: (props: any) => <Home {...props} />,
  Store: (props: any) => <ShoppingBag {...props} />,
  ShoppingBag: (props: any) => <ShoppingBag {...props} />,
  Diamond: (props: any) => <Diamond {...props} />, // Using Diamond as Rhombus
  Video: (props: any) => <Video {...props} />,
  // Added Smartphone to match usage in constants.ts
  Smartphone: (props: any) => <Smartphone {...props} />,
  Vibration: (props: any) => <Smartphone {...props} />,
  Auto: (props: SkillAssetIconProps) => <SkillAssetIcon src="/assets/skill-icons/auto.webp" {...props} />,
  Scan: (props: SkillAssetIconProps) => <SkillAssetIcon src="/assets/skill-icons/scan.webp" {...props} />,
  Reveal: (props: SkillAssetIconProps) => <SkillAssetIcon src="/assets/skill-icons/reveal.webp" {...props} />,
  Gift: (props: any) => <Gift {...props} />,
  Clock: (props: any) => <Clock {...props} />,
  Sun: (props: any) => <Sun {...props} />,
  Moon: (props: any) => <Moon {...props} />,
  System: (props: any) => <Laptop {...props} />,
  Lock: (props: any) => <Lock {...props} />,
  LockOpen: (props: any) => <Unlock {...props} />, // Map LockOpen to Unlock component
  Unlock: (props: any) => <Unlock {...props} />,
  Film: (props: any) => <Film {...props} />,
  BarChart: (props: any) => <BarChart3 {...props} />,
  Hand: (props: any) => <Hand {...props} />,
  Battery: (props: any) => <BatteryCharging {...props} />,
  Sparkles: (props: any) => <Sparkles {...props} />,
  Cassette: (props: any) => <CassetteTape {...props} />,
  Wind: (props: any) => <Wind {...props} />,
  Drum: (props: any) => <Drum {...props} />,
  Share: (props: any) => <Share {...props} />,
  Info: (props: any) => <Info {...props} />,
  Keyboard: (props: any) => <Keyboard {...props} />,
  Gamepad: (props: any) => <Gamepad2 {...props} />,
  Droplets: (props: any) => <Droplets {...props} />,
  Music: (props: any) => <Music {...props} />,
  Smile: (props: any) => <Smile {...props} />,
  Paper: (props: any) => <FileText {...props} />,
  Wood: (props: any) => <Trees {...props} />,
  Water: (props: any) => <Waves {...props} />,
  Bell: (props: any) => <Bell {...props} />,
  Heart: (props: any) => <Heart {...props} />,
  Trophy: (props: any) => <Trophy {...props} />,
  User: (props: any) => <User {...props} />,
  Medal: (props: any) => <Medal {...props} />,
  Flame: (props: any) => <Flame {...props} />,
  Star: (props: any) => <Star {...props} />,
  Crown: (props: any) => <Crown {...props} />,
  Fish: (props: any) => <Fish {...props} />,
  Mountain: (props: any) => <Mountain {...props} />,
  Gem: (props: any) => <Gem {...props} />,
  Stone: (props: any) => <Mountain {...props} />,
  Crystal: (props: any) => <Gem {...props} />,
  Piano: (props: any) => <Piano {...props} />,
  PixelEight: (props: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" shapeRendering="crispEdges" {...props}>
      <path d="M7 3h10v3H7zM5 6h3v5H5zM16 6h3v5h-3zM7 10.5h10v3H7zM5 13h3v5H5zM16 13h3v5h-3zM7 18h10v3H7z" />
    </svg>
  ),
  Pebbles: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 17.2c0-1.7 1.7-3 3.8-3h8.4c2.1 0 3.8 1.3 3.8 3s-1.7 3-3.8 3H7.8c-2.1 0-3.8-1.3-3.8-3Z" />
      <path d="M6.5 12.2c0-1.5 1.5-2.7 3.4-2.7h4.2c1.9 0 3.4 1.2 3.4 2.7s-1.5 2.7-3.4 2.7H9.9c-1.9 0-3.4-1.2-3.4-2.7Z" />
      <path d="M9 8c0-1.3 1.3-2.3 3-2.3s3 1 3 2.3-1.3 2.3-3 2.3S9 9.3 9 8Z" />
    </svg>
  ),
  CrystalCluster: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3 4 5.5-2 11.5h-4L8 8.5 12 3Z" />
      <path d="m5.5 9 2.8 3.8-1.4 7.2H4.2L3 12.8 5.5 9Z" />
      <path d="m18.5 9 2.5 3.8-1.2 7.2h-2.7l-1.4-7.2L18.5 9Z" />
      <path d="m12 3 2 17" />
    </svg>
  ),
  Koto: (props: any) => <Guitar {...props} />,
  Flower: (props: any) => <Flower2 {...props} />,
  Ticket: (props: any) => <Ticket {...props} />,
};
