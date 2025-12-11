import './FormInput.css';
import SearchableSelect from './SearchableSelect';

export default function FormInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  options = [], // For select
  rows = 3, // For textarea
  tooltip // New prop for tooltip
}) {
  const inputId = `input-${name}`;

  return (
    <div className="form-input-group">
      {type !== 'searchable-select' && (
        <div className="form-label-container">
          <label htmlFor={inputId} className="form-label">
            {label}
            {required && <span className="required">*</span>}
          </label>
          {tooltip && (
            <div className="tooltip-wrapper">
              <span className="tooltip-icon" title={tooltip}>ⓘ</span>
              <div className="tooltip-popup">{tooltip}</div>
            </div>
          )}
        </div>
      )}

      {type === 'textarea' ? (
        <textarea
          id={inputId}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          className="form-textarea"
        />
      ) : type === 'select' ? (
        <select
          id={inputId}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className="form-select"
        >
          <option value="">Select {label}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'searchable-select' ? (
        <div className="searchable-select-with-tooltip">
          <SearchableSelect
            name={name}
            value={value}
            onChange={onChange}
            options={options}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            label={label} // Pass the label to the component
          />
          {tooltip && (
            <div className="tooltip-wrapper tooltip-select">
              <span className="tooltip-icon" title={tooltip}>ⓘ</span>
              <div className="tooltip-popup">{tooltip}</div>
            </div>
          )}
        </div>
      ) : type === 'checkbox' ? (
        <div className="form-checkbox">
          <input
            id={inputId}
            type="checkbox"
            name={name}
            checked={value}
            onChange={onChange}
            disabled={disabled}
          />
          <label htmlFor={inputId} className="checkbox-label">
            {placeholder || label}
          </label>
        </div>
      ) : (
        <input
          id={inputId}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          step={type === 'number' ? '0.01' : undefined}
          className="form-input"
        />
      )}
    </div>
  );
}
