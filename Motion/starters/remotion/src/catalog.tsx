// The Remotion half of the graphics library: what each template is for and the settings the storyboard shows.
import React from 'react';
import { Captions, EndCard, LowerThird, Stat, TitleCard } from './templates';

export type Param = { id: string; label: string; type: 'text' | 'longtext' | 'number' | 'bool' | 'enum'; default?: any; options?: string[]; from?: string };
export type Tpl = { id: string; name: string; engine: 'remotion'; kind: string; about: string; seconds: number; component: React.FC<any>; params: Param[] };

export const CATALOG: Tpl[] = [
  { id: 'lower-third', name: 'Lower third', engine: 'remotion', kind: 'lower-third', seconds: 4, component: LowerThird,
    about: 'Name and role for whoever is on screen. Fills itself from People.',
    params: [{ id: 'name', label: 'Name', type: 'text', default: 'Jerry Norton', from: 'person' }, { id: 'role', label: 'Role / title', type: 'text', default: '' }, { id: 'align', label: 'Align', type: 'enum', options: ['left', 'center'], default: 'left' }] },
  { id: 'title-card', name: 'Title card', engine: 'remotion', kind: 'title', seconds: 3.5, component: TitleCard,
    about: 'Kicker, big title and a line under it — openers and chapter breaks.',
    params: [{ id: 'kicker', label: 'Kicker', type: 'text', default: 'Owners Club' }, { id: 'title', label: 'Title', type: 'text', default: 'Huntington Beach', from: 'title' }, { id: 'subtitle', label: 'Subtitle', type: 'text', default: '' }, { id: 'scrim', label: 'Darken behind', type: 'bool', default: true }] },
  { id: 'captions', name: 'Captions', engine: 'remotion', kind: 'captions', seconds: 4, component: Captions,
    about: 'Social captions, a few words at a time with the spoken word lit. Uses the transcript when the clip has one.',
    params: [{ id: 'text', label: 'Words', type: 'longtext', default: 'This is the moment everything changed', from: 'transcript' }, { id: 'position', label: 'Position', type: 'enum', options: ['low', 'middle'], default: 'low' }] },
  { id: 'stat', name: 'Stat callout', engine: 'remotion', kind: 'stat', seconds: 3, component: Stat,
    about: 'A number that counts up, with what it means.',
    params: [{ id: 'value', label: 'Number', type: 'number', default: 2500 }, { id: 'prefix', label: 'Before', type: 'text', default: '' }, { id: 'suffix', label: 'After', type: 'text', default: '+' }, { id: 'label', label: 'Label', type: 'text', default: 'investors in the room' }] },
  { id: 'end-card', name: 'End card', engine: 'remotion', kind: 'end-card', seconds: 3.5, component: EndCard,
    about: 'Logo or wordmark, a closing line and the call to action.',
    params: [{ id: 'line', label: 'Closing line', type: 'text', default: 'See you at the next one' }, { id: 'cta', label: 'Call to action', type: 'text', default: '' }, { id: 'date', label: 'Date', type: 'text', default: '', from: 'date' }, { id: 'opaque', label: 'Solid background', type: 'bool', default: true }] },
];
export const byId = (id: string) => CATALOG.find((t) => t.id === id);
