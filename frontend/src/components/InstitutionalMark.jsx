import { getInstitutionMeta, INSTITUTION_CONFIG, PRODUCT_CONFIG } from '../config';

const InstitutionalMark = ({ compact = false, inverse = false }) => (
  <div className={`institutional-mark${compact ? ' institutional-mark--compact' : ''}${inverse ? ' institutional-mark--inverse' : ''}`}>
    <img
      className="institutional-mark__crest"
      src={INSTITUTION_CONFIG.logoUrl}
      width="64"
      height="64"
      alt=""
      decoding="async"
    />
    <span className="institutional-mark__copy">
      <strong>{PRODUCT_CONFIG.name}</strong>
      <small>
        {[INSTITUTION_CONFIG.shortName || INSTITUTION_CONFIG.name, getInstitutionMeta()]
          .filter(Boolean)
          .join(' · ')}
      </small>
    </span>
  </div>
);

export default InstitutionalMark;
