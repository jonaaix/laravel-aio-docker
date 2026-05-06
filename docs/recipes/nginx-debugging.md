# Debugging nginx configuration

You can print all nginx variables for the current request by adding this `location` block in your custom `nginx.conf`:

```nginx
location /debug_status {
    default_type text/plain;
    return 200 "
        scheme: $scheme
        host: $host
        server_addr: $server_addr
        remote_addr: $remote_addr
        remote_port: $remote_port
        request_method: $request_method
        request_uri: $request_uri
        document_uri: $document_uri
        query_string: $query_string
        status: $status
        http_user_agent: $http_user_agent
        http_referer: $http_referer
        http_x_forwarded_for: $http_x_forwarded_for
        http_x_forwarded_proto: $http_x_forwarded_proto
        request_time: $request_time
        upstream_response_time: $upstream_response_time
        request_filename: $request_filename
        content_type: $content_type
        body_bytes_sent: $body_bytes_sent
        bytes_sent: $bytes_sent
        connection: $connection
        connection_requests: $connection_requests
        server_protocol: $server_protocol
        server_port: $server_port
        request: $request
        args: $args
        time_iso8601: $time_iso8601
        msec: $msec
        uri: $uri
    ";
}
```

Then `curl http://localhost:8000/debug_status` (or hit it from your browser) to see the full request context. Useful when reverse-proxy headers (`X-Forwarded-*`) aren't behaving as expected, or to verify path mappings.

::: warning
Remove this block before deploying to production — it leaks request internals.
:::
