---
layout: post
title:  "Announcing mockfn"
date:   2018-03-22 19:00:00
categories: clojure mocking testing test-driven-design
---

[`mockfn`](https://github.com/pmatiello/mockfn) is a library supporting mockist test-driven-development in Clojure. It is meant to be used alongside a regular testing framework such as `clojure.test`.

It provides two macros to be used in tests. The first, `providing`, replaces a function with a configured mock.

{% highlight clojure %}
(testing "providing"
  (providing [(one-fn) :result]
    (is (= :result (one-fn)))))
{% endhighlight %}

The second macro, `verifying`, works similarly, but also defines an expectation for the number of times a call should be performed during the test.

{% highlight clojure %}
(testing "verifying"
  (verifying [(one-fn :argument) :result (exactly 1)]
    (is (= :result (one-fn :argument)))))
{% endhighlight %}

Argument matchers are also supported:

{% highlight clojure %}
(testing "argument matchers"
  (providing [(one-fn (at-least 10) (at-most 20)) 15]
    (is (= 15 (one-fn 12 18))))))
{% endhighlight %}

[Project page](https://github.com/pmatiello/mockfn)

[Documentation](https://github.com/pmatiello/mockfn/blob/master/doc/documentation.md)