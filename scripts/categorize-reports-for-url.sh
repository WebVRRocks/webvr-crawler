#!/usr/bin/env bash

curl -X GET http://localhost:3030/categorize -G --data-urlencode q@- <<REQUEST_BODY
{
  "pageSize": "30",
  "query": {
    "AND": {
      "*": [
        "*"
      ]
    },
    "report_type": [
      "success",
      "failure"
    ]
  },
  "category": {
    "field": "report_type"
  }
}
REQUEST_BODY
