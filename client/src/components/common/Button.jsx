import './Button.css';

export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  onClick,
  disabled = false,
  loading = false,
  className = ''
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className} ${loading ? 'loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <span className="spinner-small"></span>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
