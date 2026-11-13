FROM mono:6.12
WORKDIR /site
COPY app/webforms/ /site/
RUN apt-get update && apt-get install -y --no-install-recommends mono-xsp4 nuget && rm -rf /var/lib/apt/lists/* \
    && nuget install Npgsql -Version 3.2.7 -OutputDirectory /tmp/packages \
    && mkdir -p bin && cp /tmp/packages/Npgsql.3.2.7/lib/net45/Npgsql.dll bin/ \
    && mcs -target:library -r:System.Web -r:System.Data -r:bin/Npgsql.dll -out:bin/EagleDesk.WebForms.dll Default.aspx.cs
EXPOSE 8081
CMD ["xsp4", "--port", "8081", "--address", "0.0.0.0", "--nonstop"]
