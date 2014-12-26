---
layout: post
title:  "Using a different configuration file when running tests in a Play project"
date:   2014-12-26 11:00:00
categories: scala playframework testing
---

[Play Framework](https://www.playframework.com), as of version 2.3.x, typically loads the configuration for your application from `conf/application.conf`. Although it works as expected, it doesn't allow for different configurations to be used in different environments unless the file is replaced. This is specially inconvenient when running tests directly from [Activator](https://typesafe.com/community/core-tools/activator-and-sbt) since these tests will be executed against the same database used for running the application in development mode.

Luckly, [Typesafe Config](https://github.com/typesafehub/config) and [SBT](https://typesafe.com/community/core-tools/activator-and-sbt) provide all that is necessary to work around this issue cleanly.

First create a configuration file, say `conf/application.test.conf`, for the Test mode. This file will inherit all settings defined in the main configuration file through the `include` statement, but will also override the values that should be different when running tests.

```
include "application.conf"

db.default.driver="org.postgresql.Driver"
db.default.url="jdbc:postgresql://localhost/project_name_test"
db.default.user="username"
db.default.password="password"
```

Then, configure SBT to instruct Play to load this file when running in Test mode by adding the line below to your `build.sbt`.

{% highlight scala %}
javaOptions in Test += "-Dconfig.file=conf/application.test.conf"
{% endhighlight %}

This should be enough.
