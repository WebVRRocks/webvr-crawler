let lineObj = {};

(data || '').toString().trim().split('\n').forEach((line, idx) => {
  lineObj = {};

  try {
    lineObj = JSON.parse(line);
  } catch (e) {
  }

  if (!lineObj) {
    return;
  }

  lineObj._id = idx;

  index._lookup[String(idx)] = lineObj;

  index.addDoc(lineObj);
});

const getQueryByTerm = q => index.search(q, {
  fields: {
    url: {
      boost: 2,
      bool: 'OR',
      expand: true
    },
    type: {
      bool: 'AND'
    },
    message: {
      boost: 1
    }
  }
});

const getQueryByUrl = q => index.search(q, {
  fields: {
    url: {
      bool: 'OR',
      expand: true
    }
  }
});

const getItemByRef = ref => {
  if (typeof ref === 'object') {
    if ('ref' in ref) {
      ref = ref.ref;
    } else if ('_id' in ref) {
      ref = ref._id;
    }
  }
  ref = String(ref);
  return index._lookup[ref];
};

const getResults = items => items.map(getItemByRef);

const getResultsByUrl = q => getResults(getQueryByUrl(q)).map(item => {
  return item;
});

const getReportsByUrl = q => {
  const results = getResults(getQueryByUrl(q));

  let resultsByType = {
    '*': {
      count: 0,
      items: []
    },
    success: {
      count: 0,
      items: []
    },
    failure: {
      count: 0,
      items: []
    },
  };

  results.forEach(item => {
    if (!item) {
      return;
    }

    item = getItemByRef(item);

    if (!item) {
      return;
    }

    if (item.type === 'success') {
      resultsByType.success.items.push(item);
      resultsByType.success.count++;
    }

    if (item.type === 'failure') {
      resultsByType.failure.items.push(item);
      resultsByType.failure.count++;
    }

    resultsByType['*'].items.push(item);
    resultsByType['*'].count++;
  });

  return resultsByType;
};

const getReportsByUrlSummary = q => {
  const reports = getReportsByUrl(q);
  return {
    total_count: reports['*'].count,
    success: reports.success.count,
    failure: reports.failure.count
  };
};

let handlers = {
  reports: {
    summary: {
    }
  }
};

handlers.reports.get = q => {
  const reports = getReportsByUrl(q);
  return Object.assign(reports, {
    url: `${apiHost}/reports?url=${q}`
  });
};

handlers.reports.summary.get = q => {
  const reports = getReportsByUrlSummary(q);
  return Object.assign(reports, {
    url: `${apiHost}/reports/summaries?url=${q}`
  });
};

console.log(JSON.stringify(handlers.reports.get(argv[0]), null, 2));
// console.log(JSON.stringify(handlers.reports.summary.get(argv[0]), null, 2));
