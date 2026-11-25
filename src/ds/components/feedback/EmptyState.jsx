import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/** Describes the record that would be here, then offers the permitted action.
 *  A muted glyph, one line of title, a short description, an optional action. */
export function EmptyState({ icon = 'inbox', title, description, action, style }) {
  return (
    <div className="tk-empty" style={style}>
      <span className="tk-empty-icon" aria-hidden="true"><Icon name={icon} size={18} /></span>
      <span className="tk-empty-title">{title}</span>
      {description && <span className="tk-empty-description">{description}</span>}
      {action && <div className="tk-empty-action">{action}</div>}
    </div>
  );
}
