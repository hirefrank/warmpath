export const sampleLinkedInSearchHtml = `
<html>
  <body>
    <ul>
      <li class="reusable-search__result-container">
        <div class="entity-result__item">
          <span class="entity-result__title-text t-16">
            <span aria-hidden="true">Taylor Candidate</span>
          </span>
          <a href="/in/taylor-candidate-1234/?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AABC">
            View profile
          </a>
          <div class="entity-result__primary-subtitle">Senior Product Manager</div>
          <div class="entity-result__secondary-subtitle">Acme</div>
        </div>
      </li>

      <li class="reusable-search__result-container">
        <div class="entity-result__item">
          <a href="https://www.linkedin.com/in/jordan-recruiter-9988/">Jordan Recruiter</a>
          <div class="entity-result__primary-subtitle">Senior Recruiter</div>
          <div class="entity-result__secondary-subtitle">Acme</div>
        </div>
      </li>

      <li>
        <a href="https://www.linkedin.com/learning/">LinkedIn Learning</a>
      </li>
    </ul>
  </body>
</html>
`;

export const fallbackAnchorOnlyHtml = `
<html>
  <body>
    <div>
      <a href="/in/alex-ops-4512/">Alex Ops</a>
      <div class="entity-result__primary-subtitle">Operations Manager</div>
      <div class="entity-result__secondary-subtitle">Acme</div>
    </div>
  </body>
</html>
`;

export const jsonBlobOnlyHtml = `
<html>
  <body>
    <script type="application/json">
      {"included":[{"firstName":"Morgan","lastName":"Builder","publicIdentifier":"morgan-builder-55","occupation":"Product Manager at Acme"}]}
    </script>
  </body>
</html>
`;
