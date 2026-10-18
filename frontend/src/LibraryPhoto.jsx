import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

const cache = new Map();
const queue = [];
let running = 0;

function schedule(task) {
  return new Promise(resolve => {
    queue.push({ task, resolve });
    pump();
  });
}

function finishJob() {
  running -= 1;
  pump();
}

function pump() {
  while (running < 3 && queue.length) {
    const job = queue.shift();
    running += 1;

    Promise.resolve()
      .then(job.task)
      .catch(() => null)
      .then(job.resolve)
      .finally(finishJob);
  }
}

async function wiki(parameters) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    10000
  );

  try {
    const query = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      ...parameters,
    });

    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?${query}`,
      {
        signal: controller.signal,
        credentials: 'omit',
      }
    );

    if (!response.ok) {
      throw new Error('Image service unavailable');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error('Image service unavailable');
    }

    return Object.values(data.query?.pages || {});
  } finally {
    clearTimeout(timer);
  }
}

const plain = html =>
  new DOMParser()
    .parseFromString(html || '', 'text/html')
    .body.textContent.trim();

const safeLink = url =>
  /^https:\/\//i.test(url || '') ? url : undefined;

function loadPhoto(subject) {
  if (!cache.has(subject)) {
    cache.set(
      subject,
      schedule(async () => {
        const pages = await wiki({
          titles: subject,
          redirects: '1',
          prop: 'pageimages',
          piprop: 'name',
          pilicense: 'free',
        });

        const name = pages.find(
          page => page.pageimage
        )?.pageimage;

        if (!name) return null;

        const files = await wiki({
          titles: `File:${name}`,
          prop: 'imageinfo',
          iiprop: 'url|extmetadata',
          iiurlwidth: '640',
        });

        const info = files.find(
          page => page.imageinfo?.length
        )?.imageinfo[0];

        const metadata = info?.extmetadata || {};
        const artist = plain(metadata.Artist?.value);
        const license = plain(
          metadata.LicenseShortName?.value
        );
        const source = safeLink(info?.descriptionurl);
        const url = safeLink(info?.thumburl || info?.url);

        if (!url || !source || !artist || !license) {
          return null;
        }

        return {
          url,
          source,
          artist,
          license,
          licenseUrl: safeLink(metadata.LicenseUrl?.value),
        };
      })
    );
  }

  return cache.get(subject);
}

export default function LibraryPhoto({
  subject,
  src,
  label,
}) {
  const box = useRef(null);
  const [visible, setVisible] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' }
    );

    if (box.current) observer.observe(box.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    setPhoto(null);
    setFailed(false);

    if (visible && !src) {
      loadPhoto(subject).then(result => {
        if (active) {
          setPhoto(result);
          setFailed(!result);
        }
      });
    }

    return () => {
      active = false;
    };
  }, [visible, src, subject, attempt]);

  const url = src || photo?.url;

  function retry() {
    cache.delete(subject);
    setFailed(false);
    setAttempt(value => value + 1);
  }

  return (
    <figure className="vl-photo" ref={box}>
      <div className="vl-image-area">
        {!failed && visible && url ? (
          <img
            src={url}
            alt={label || subject}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="vl-photo-placeholder">
            <span aria-hidden="true">▧</span>
            <span>
              {failed ? 'Photo unavailable' : 'Loading photo…'}
            </span>

            {failed && (
              <button onClick={retry}>
                Retry image
              </button>
            )}
          </div>
        )}
      </div>

      <figcaption>
        {src ? (
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Photo: Unsplash
          </a>
        ) : photo && !failed ? (
          <>
            <span>Illustration: {subject}. </span>
            <a
              href={photo.source}
              target="_blank"
              rel="noopener noreferrer"
            >
              {photo.artist}
            </a>
            {' · '}
            <a
              href={photo.licenseUrl || photo.source}
              target="_blank"
              rel="noopener noreferrer"
            >
              {photo.license}
            </a>
          </>
        ) : (
          <span>Illustration for: {subject}</span>
        )}
      </figcaption>
    </figure>
  );
}
