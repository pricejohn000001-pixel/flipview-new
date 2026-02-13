import {
  MdAutoFixHigh,
  MdBookmark,
  MdBookmarkAdd,
  MdBrush,
  MdComment,
  MdContentCut,
  MdFormatColorFill,
  MdFormatStrikethrough,
  MdFormatUnderlined,
  MdHighlight,
  MdViewSidebar,
} from 'react-icons/md';

export const WORKSPACE_ERASER_TOOL_ID = 'workspaceEraser';

export const TOOL_TYPES = [
  { id: 'select', label: 'Select', icon: MdViewSidebar },
  { id: 'highlight', label: 'Area Highlight', icon: MdHighlight },
  { id: 'textHighlight', label: 'Text Highlight', icon: MdFormatColorFill },
  { id: 'underline', label: 'Underline', icon: MdFormatUnderlined },
  { id: 'strike', label: 'Strike-through', icon: MdFormatStrikethrough },
  { id: 'freehand', label: 'Freehand', icon: MdBrush },
  { id: WORKSPACE_ERASER_TOOL_ID, label: 'Eraser', icon: MdAutoFixHigh },
  { id: 'comment', label: 'Note', icon: MdComment },
  { id: 'bookmark', label: 'Bookmark', icon: MdBookmarkAdd },
  { id: 'clip', label: 'Clip Area', icon: MdContentCut },
];

export const ANNOTATION_TYPES = ['highlight', 'underline', 'strike', 'freehand', 'comment'];

export const COLOR_OPTIONS = ['#fbbf24', '#f97316', '#a855f7', '#22c55e', '#3b82f6', '#ef4444'];

export const FREEHAND_COLORS = [
  '#1d4ed8', '#dc2626', '#22c55e', '#facc15', '#111827',
  '#0ea5e9', '#4ade80', '#9ca3af', '#000000', '#a1a1aa',
  '#fde047', '#7f1d1d', '#475569', '#a855f7', '#f472b6',
  '#6366f1', '#fb7185', '#f97316', '#14b8a6', '#f0abfc',
];

export const BRUSH_SIZES = [
  { id: 'hairline', label: 'Hairline', value: 5.2, preview: 4 },
  { id: 'fine', label: 'Fine', value: 5.8, preview: 6 },
  { id: 'medium', label: 'Medium', value: 25.6, preview: 8 },
  { id: 'bold', label: 'Bold', value: 35.6, preview: 12 },
  { id: 'marker', label: 'Marker', value: 45.8, preview: 18 },
];

export const DEFAULT_BRUSH_SIZE = BRUSH_SIZES[2].value;
export const DEFAULT_BRUSH_OPACITY = 1;

export const WORKSPACE_FIXED_WIDTH_PX = 1000;
export const WORKSPACE_RESIZER_WIDTH = 18;
export const WORKSPACE_SLIDE_MIN = 0;
export const WORKSPACE_SLIDE_MAX = WORKSPACE_FIXED_WIDTH_PX;
export const WORKSPACE_LEFT_STACK_X = 0.08;
export const WORKSPACE_LEFT_STACK_SPREAD = 0.04;

// API endpoints
export const API_ENDPOINTS = {
  GET_ANNOTATIONS: 'user/pdf-anotaion?action=get-annotations',
  STORE_ANNOTATIONS: 'user/pdf-anotaion?action=store-anotation',
  UPDATE_ANNOTATIONS: 'user/pdf-anotaion?action=update-annotation'
};

