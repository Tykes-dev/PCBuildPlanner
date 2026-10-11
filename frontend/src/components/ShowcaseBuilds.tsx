import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/axios';
import { ComponentImage } from './ComponentImage';
import { LABELS, pesos } from '../types';
import { profileLabel, type SavedBuild } from '../types/builds';

// A grid rather than a sliding track. The shop usually publishes two or three
// builds, and a carousel holding one card reserves a full-width row, draws
// arrows that do nothing and tells the visitor to swipe.
export function ShowcaseBuilds({ guest = false }: { guest?: boolean }) {
  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get<SavedBuild[]>('/showcase')
      .then(response => { if (!cancelled) setBuilds(response.data.slice(0, 6)); })
      .catch(() => { if (!cancelled) setBuilds([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Nothing published is a normal state, so the section stays out of the way
  // rather than showing an empty shelf.
  if (loading || !builds.length) return null;

  return <section className="showcase" aria-labelledby="showcase-heading">
    <div className="section-heading">
      <div>
        <span className="eyebrow">READY WHEN YOU ARE</span>
        <h2 id="showcase-heading">Builds the shop put together.</h2>
      </div>
      <Link to="/components" className="text-link">See the parts they used <span aria-hidden="true">↗</span></Link>
    </div>

    <ul className="showcase-grid">
      {builds.map(build => {
        // The priciest part is the one a customer recognises, so it leads.
        const ranked = [...build.items].sort((left, right) => right.component.price - left.component.price);
        const [hero, ...rest] = ranked;
        return <li key={build.id} className="build-card">
          {/* A photo of a finished unit if the shop added one. It does not have
              to be these exact parts, it has to look like the machine. Falling
              back to the leading part keeps older published builds looking
              right. */}
          <div className={'build-photo' + (build.imageUrl ? ' unit' : '')}>
            {build.imageUrl
              ? <>
                {/* The same photo, blurred, fills the frame behind. The real
                    one is then contained rather than cropped, so a tall tower
                    shot and a wide desk shot both sit in the frame without
                    losing their edges or leaving dead space. */}
                <span className="photo-wash" aria-hidden="true"
                  style={{ backgroundImage: `url("${build.imageUrl.replace(/"/g, '%22')}")` }}/>
                <img src={build.imageUrl} alt={build.name} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>
              </>
              : hero
                ? <ComponentImage component={hero.component}/>
                : <div className="component-image"><div className="image-placeholder"><span>No parts yet</span></div></div>}
            <span className="build-price">{pesos(build.total)}</span>
          </div>
          <div className="build-body">
            <div className="build-title">
              <h3>{build.name}</h3>
              <span className="tag">{profileLabel(build.profileSlug)}</span>
            </div>
            <p className="row-sub">{build.items.length} of 7 categories{hero ? ' · built around the ' + LABELS[hero.component.category].toLowerCase() : ''}</p>
            {Boolean(rest.length) && <ul className="build-thumbs">
              {rest.slice(0, 4).map(item => <li key={item.component._id}
                title={LABELS[item.component.category] + ' · ' + item.component.name}>
                <ComponentImage component={item.component} compact/>
              </li>)}
              {rest.length > 4 && <li className="more" aria-hidden="true">+{rest.length - 4}</li>}
            </ul>}
            {/* The id travels in the URL, not in React state: state is wiped
                when a guest signs in, and most visitors here are guests. */}
            <Link className="button secondary"
              to={guest ? '/auth?next=' + encodeURIComponent('/builder?from=' + build.id) : '/builder?from=' + build.id}>
              {guest ? 'Log in to open this build' : 'Open this in the planner'} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </li>;
      })}
    </ul>
    <p className="showcase-foot">Prices are the shop's sample values. Opening one starts a fresh plan at that budget rather than copying the build.</p>
  </section>;
}