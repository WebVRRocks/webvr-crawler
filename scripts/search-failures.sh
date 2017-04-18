#!/usr/bin/env bash

curl -X GET http://localhost:3030/search -G --data-urlencode q@- <<REQUEST_BODY
{
  "query": {
    "AND": {
      "report_type": [
        "failure"
      ]
    }
  }
}
REQUEST_BODY
